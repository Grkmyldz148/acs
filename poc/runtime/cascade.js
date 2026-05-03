/* cascade.js — selector compile + cascade resolution.
 *
 * Selector syntax supported (PoC scope):
 *   tag, .class, tag.class
 *   suffix: :hover | :focus | :on-click | :on-enter | :on-focus | :on-input
 */

// Parse attribute selectors: [attr], [attr=value], [attr="value"].
// Returns { stripped: selectorWithoutAttrs, attrs: [{name, value?}] }.
function extractAttributeSelectors(s) {
  const attrs = [];
  const stripped = s.replace(
    /\[([a-zA-Z_-][\w-]*)(?:=("([^"]*)"|'([^']*)'|([^\]]*)))?\]/g,
    (_, name, _v, dq, sq, raw) => {
      const value = dq ?? sq ?? raw ?? null;
      attrs.push({ name, value });
      return "";
    }
  );
  return { stripped, attrs };
}

// Parse :not(simple-selector) suffixes. Returns { stripped, nots: [simple] }
// where each `simple` is a compiled simple-selector to be NEGATED at match
// time. ACS supports a subset of CSS :not() — only simple selectors inside
// (no combinators, no nested :not). Multiple :not()s allowed and AND'd.
function extractNotSelectors(s, compileSimple) {
  const nots = [];
  const stripped = s.replace(/:not\(([^)]+)\)/g, (_, inner) => {
    nots.push(compileSimple(inner.trim()));
    return "";
  });
  return { stripped, nots };
}

// Compile cache — same selector string yields the same compiled result.
// Theme switches re-call bindAll with the same selectors; caching saves
// a per-rule recompile (each ~1µs but adds up at hot reload + ANY large
// stylesheet). Bounded to ~1k entries to avoid pathological growth.
const compileCache = new Map();
const COMPILE_CACHE_MAX = 1024;

export function compileSelector(sel) {
  const cached = compileCache.get(sel);
  if (cached) return cached;
  const compiled = compileSelectorImpl(sel);
  if (compileCache.size >= COMPILE_CACHE_MAX) {
    // FIFO eviction — drop the oldest entry. Map iteration order is insertion.
    const firstKey = compileCache.keys().next().value;
    compileCache.delete(firstKey);
  }
  compileCache.set(sel, compiled);
  return compiled;
}

function compileSelectorImpl(sel) {
  let event = null;
  let core = sel;

  const stateMatch = sel.match(
    /(:hover|:focus|:on-click|:on-enter|:on-focus|:on-input|:on-appear|:on-leave)$/
  );
  if (stateMatch) {
    const state = stateMatch[1];
    core = sel.slice(0, -state.length);
    if (state === ":hover" || state === ":on-enter") event = "enter";
    else if (state === ":focus" || state === ":on-focus") event = "focus";
    else if (state === ":on-click") event = "click";
    else if (state === ":on-input") event = "input";
    else if (state === ":on-appear") event = "appear";
    else if (state === ":on-leave") event = "leave";
  }

  // Detect descendant combinator (single space). For "A B", the rightmost
  // simple selector is the target; the rest are ancestor constraints.
  // Child (`>`), sibling (`+`, `~`) combinators aren't natively supported
  // — degrade to descendant matching with a one-time dev console warning
  // so users aren't silently surprised.
  if (/[>+~]/.test(core)) {
    if (typeof console !== "undefined" && !compileSelector._warnedCombinators) {
      console.warn(
        '[acs] selector "' + sel + '" uses an unsupported combinator (>, +, ~). ' +
        'ACS only supports descendant (space). Treating as descendant — match may be too broad.'
      );
      compileSelector._warnedCombinators = true;
    }
    core = core.replace(/\s*[>+~]\s*/g, " ");
  }
  // Bracket-aware split on descendant whitespace. A naive `split(/\s+/)`
  // would break attribute values that contain spaces (`[data-state="a b"]`)
  // and treat the inner space as a descendant combinator. Walk the string
  // tracking bracket / quote depth and only split outside them.
  const parts = [];
  let depth = 0, inSq = false, inDq = false, buf = "";
  for (let i = 0; i < core.length; i++) {
    const ch = core[i];
    if (!inSq && !inDq) {
      if (ch === "[") depth++;
      else if (ch === "]") depth = Math.max(0, depth - 1);
      else if (ch === '"') inDq = true;
      else if (ch === "'") inSq = true;
      else if (depth === 0 && /\s/.test(ch)) {
        if (buf) { parts.push(buf); buf = ""; }
        continue;
      }
    } else {
      if (inDq && ch === '"') inDq = false;
      else if (inSq && ch === "'") inSq = false;
    }
    buf += ch;
  }
  if (buf) parts.push(buf);
  const targetSel = parts[parts.length - 1] || "";
  const ancestorSels = parts.slice(0, -1);

  const compileSimple = (s) => {
    // Strip :not(...) parts first so they don't interfere with the rest
    // of the simple-selector parsing. Pass compileSimpleInner so :not()
    // can compile its argument as a (single-level) simple selector.
    const { stripped: noNots, nots } = extractNotSelectors(s, compileSimpleInner);
    const { stripped, attrs } = extractAttributeSelectors(noNots);
    // Split on `.` to support compound classes: "tag.a.b.c" → tag + [a,b,c].
    const parts = stripped.split(".");
    const tag = parts[0] || null;
    const classes = parts.slice(1).filter(Boolean);
    const universal = tag === "*" || tag === "";
    // Cache lowercase tag so simpleMatch can skip toLowerCase() per call.
    return { tag: tag || null, tagLower: tag ? tag.toLowerCase() : null,
             classes, attrs, universal, nots };
  };
  // Inner compile (used by :not()) — same shape but no nested :not handling.
  function compileSimpleInner(s) {
    const { stripped, attrs } = extractAttributeSelectors(s);
    const parts = stripped.split(".");
    const tag = parts[0] || null;
    const classes = parts.slice(1).filter(Boolean);
    const universal = tag === "*" || tag === "";
    return { tag: tag || null, tagLower: tag ? tag.toLowerCase() : null,
             classes, attrs, universal, nots: [] };
  }

  const target = compileSimple(targetSel);
  const ancestors = ancestorSels.map(compileSimple);

  const simpleMatch = (el, def) => {
    if (!el || el.nodeType !== 1) return false;
    if (!def.universal && def.tagLower &&
        el.tagName.toLowerCase() !== def.tagLower)
      return false;
    for (const cls of def.classes) {
      if (!el.classList.contains(cls)) return false;
    }
    for (const a of def.attrs) {
      if (a.value === null) {
        if (!el.hasAttribute(a.name)) return false;
      } else {
        if (el.getAttribute(a.name) !== a.value) return false;
      }
    }
    // :not(simple) — element must NOT match each negated simple selector.
    if (def.nots && def.nots.length) {
      for (const neg of def.nots) {
        if (simpleMatch(el, neg)) return false;
      }
    }
    return true;
  };

  const matches = (el) => {
    if (!simpleMatch(el, target)) return false;
    if (ancestors.length === 0) return true;
    // Walk up ancestor chain matching ancestor selectors right-to-left.
    let current = el.parentElement;
    let aIdx = ancestors.length - 1;
    while (current && aIdx >= 0) {
      if (simpleMatch(current, ancestors[aIdx])) {
        aIdx--;
      }
      current = current.parentElement;
    }
    return aIdx < 0;
  };

  // Specificity weights match CSS conventions: classes and attribute
  // selectors are equally weighted (both (0,1,0) in CSS). Earlier we used
  // class=10/attr=5 which made `.toast` always beat `[data-state=success]`
  // — wrong, since CSS treats them as equal and resolves by source order.
  const specificity =
    (target.tag ? 1 : 0) +
    target.classes.length * 10 +
    target.attrs.length * 10 +
    ancestors.length * 2 +
    (event ? 1 : 0);

  return { matches, event, specificity, raw: sel };
}

// Build a resolver: (element) → { click: rules[], enter: rules[], ...,
// config: rules[] }. The `config` bucket holds rules that match the
// element but carry only inheritable properties (sound-mood, pitch,
// volume, room, pan, velocity-filter) and no event/sound — without this
// bucket, applyInheritance can't see them and `body { sound-mood: ... }`
// silently never reaches descendant triggers.
export function buildBindings(rules) {
  const compiled = rules.map((r) => ({
    ...compileSelector(r.selector),
    decls: r.decls,
    raw: r.selector,
  }));

  return (el) => {
    const byEvent = {
      click: [], enter: [], focus: [], input: [], appear: [], leave: [],
      config: [],
    };
    for (const r of compiled) {
      if (!r.matches(el)) continue;
      const ev =
        r.event ||
        (r.decls["sound-on-click"]
          ? "click"
          : r.decls["sound-on-enter"]
          ? "enter"
          : r.decls["sound-on-focus"]
          ? "focus"
          : r.decls["sound-on-input"]
          ? "input"
          : r.decls["sound-on-appear"]
          ? "appear"
          : r.decls["sound-on-leave"]
          ? "leave"
          : r.decls["sound"]
          ? "click"
          : null);
      if (ev) {
        byEvent[ev].push(r);
      } else {
        // Config-only rule (mood/pitch/volume/room/pan etc). Still needs
        // to be visible to applyInheritance. Push to config bucket.
        byEvent.config.push(r);
      }
    }
    Object.keys(byEvent).forEach((ev) => {
      byEvent[ev].sort((a, b) => a.specificity - b.specificity);
    });
    return byEvent;
  };
}

// Flatten cascade-ordered rules into a single decl set (later wins).
// CSS-style !important: a decl marked !important wins over any non-
// important decl regardless of selector specificity. Within important
// (or within non-important) the standard cascade order applies.
//
// Two-pass merge:
//   1. Apply non-important decls in cascade order (later spec wins).
//   2. Overlay important decls in cascade order — these can come from
//      any rule, even less-specific ones, and beat anything in pass 1.
export function flatten(rulesForEvent) {
  const out = {};
  // Pass 1 — non-important.
  for (const r of rulesForEvent) {
    const imp = r.decls.__important;
    for (const k of Object.keys(r.decls)) {
      if (imp && imp.has(k)) continue;
      out[k] = r.decls[k];
    }
  }
  // Pass 2 — important overlay.
  for (const r of rulesForEvent) {
    const imp = r.decls.__important;
    if (!imp) continue;
    for (const k of imp) out[k] = r.decls[k];
  }
  return out;
}
