/* dom.js — DOM event delegation.
 *
 * Single global listeners per event type (click, mouseenter via mouseover,
 * focus, input). At fire time, re-resolves the cascade for the current
 * target element — this means dynamic state (attribute changes like
 * `[open]`, class toggles) is correctly reflected without
 * MutationObserver wiring, and dynamically-added elements work for free.
 */

import { flatten } from "./cascade.js";

// Properties that inherit through DOM ancestry (CSS-style).
// `sound-mood`: a `body { sound-mood: warm }` covers all descendants.
// `room`: a `dialog[open] { room: small-room }` covers buttons inside it.
// `volume`/`pitch`/`pan`: cascade-style — set on a region, descendants
//   inherit unless overridden. Lets you tune zones (e.g. sidebar 0.6 vol,
//   main 1.0 vol) without repeating the value on every selector.
// `velocity-filter`: same idea — turn on darken-when-soft for a section.
// `room-mix`: per-region wet/dry override paired with `room`.
const INHERITED_PROPS = [
  "sound-mood",
  "sound-mood-mix",
  "room",
  "room-mix",
  "volume",
  "pitch",
  "pan",
  "velocity-filter",
];

let activeResolver = null;
let triggerFn = null;
let installed = false;

// Walk up DOM looking for inheritable properties on ancestors.
function applyInheritance(el, decls) {
  if (!activeResolver) return decls;
  const out = { ...decls };
  // Collect props that still need a value (own non-important decls win).
  // For each prop, also track whether the own decl was !important — only
  // inherited !important can override own non-important.
  const ownImportant = decls.__important || null;
  const remaining = INHERITED_PROPS.filter(
    (p) => !out[p] // not set on own element
  );
  // Allow inherited !important to override own non-important — push these
  // onto remaining too, but mark so we know they need to find an important.
  const overridable = new Set();
  for (const p of INHERITED_PROPS) {
    if (out[p] && !(ownImportant && ownImportant.has(p))) {
      overridable.add(p); // own non-important: an inherited !important can replace it
      remaining.push(p);
    }
  }
  if (remaining.length === 0) return out;
  let current = el.parentElement;
  while (current && remaining.length) {
    const map = activeResolver(current);
    const allRules = [];
    for (const evList of Object.values(map)) allRules.push(...evList);
    for (let i = remaining.length - 1; i >= 0; i--) {
      const prop = remaining[i];
      const onlyImportant = overridable.has(prop); // own value already there
      for (const r of allRules) {
        if (!r.decls[prop]) continue;
        const isImp = r.decls.__important && r.decls.__important.has(prop);
        if (onlyImportant && !isImp) continue; // skip non-important if own is set
        out[prop] = r.decls[prop];
        remaining.splice(i, 1);
        overridable.delete(prop);
        break;
      }
    }
    current = current.parentElement;
  }
  return out;
}

export function setResolver(fn) {
  activeResolver = fn;
}

export function setTrigger(fn) {
  triggerFn = fn;
}

function fire(el, evType, propKey, ev) {
  if (!activeResolver || !triggerFn || !el || el.nodeType !== 1) return;
  const map = activeResolver(el);
  const list = map[evType];
  if (!list || !list.length) return;
  const decls = applyInheritance(el, flatten(list));
  if (evType === "input") {
    const it = ev && ev.inputType;
    // Skip non-keystroke input events: deletion (backspace/delete),
    // history (undo/redo), paste/cut/drop. We want keystroke to fire on
    // actual character input, not bulk operations or removals.
    if (it && (it.startsWith("delete") ||
               it.startsWith("history") ||
               it === "insertFromPaste" ||
               it === "insertFromDrop" ||
               it === "deleteByCut")) return;
  }
  triggerFn(decls, propKey, el);
}

// Walk up from the event target, firing at the deepest element with a
// matching rule (mirroring CSS's "most-specific" intent).
function deepestMatching(el, evType) {
  while (el && el.nodeType === 1) {
    if (!activeResolver) return null;
    const map = activeResolver(el);
    if (map[evType] && map[evType].length) return el;
    el = el.parentElement;
  }
  return null;
}

// IntersectionObserver for :on-appear / :on-leave events.
let intersectionObserver = null;
const observed = new WeakSet();
const inView = new WeakSet();
// Elements added AFTER initial scan should fire sound-on-appear on their
// first intersection (they were never on the page before, so this IS
// their appearance). Elements present at initial-scan time are silenced
// to avoid a flood at page load.
const fireOnFirstIntersection = new WeakSet();
let initialScanComplete = false;

function ensureIntersectionObserver() {
  if (intersectionObserver || typeof IntersectionObserver === "undefined") {
    return intersectionObserver;
  }
  const settled = new WeakSet();
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (!settled.has(el)) {
          settled.add(el);
          if (entry.isIntersecting) {
            inView.add(el);
            // Dynamically-added element: fire on its first intersection
            // (this IS its appearance). Initial-scan elements skip this.
            if (fireOnFirstIntersection.has(el)) {
              fireOnFirstIntersection.delete(el);
              fire(el, "appear", "sound-on-appear", null);
            }
          }
          continue;
        }
        if (entry.isIntersecting && !inView.has(el)) {
          inView.add(el);
          fire(el, "appear", "sound-on-appear", null);
        } else if (!entry.isIntersecting && inView.has(el)) {
          inView.delete(el);
          fire(el, "leave", "sound-on-leave", null);
        }
      }
    },
    { threshold: 0.5 }
  );
  return intersectionObserver;
}

function observeIfRelevant(el) {
  if (!activeResolver || observed.has(el) || el.nodeType !== 1) return;
  const map = activeResolver(el);
  if (
    (map.appear && map.appear.length) ||
    (map.leave && map.leave.length)
  ) {
    const obs = ensureIntersectionObserver();
    if (obs) {
      observed.add(el);
      if (initialScanComplete) fireOnFirstIntersection.add(el);
      obs.observe(el);
    }
  }
}

function scanForAppearTargets() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("*").forEach(observeIfRelevant);
  initialScanComplete = true;
}

let mutationObserver = null;
function startAppearMutationObserver() {
  if (mutationObserver || typeof MutationObserver === "undefined") return;
  mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        observeIfRelevant(n);
        n.querySelectorAll && n.querySelectorAll("*").forEach(observeIfRelevant);
      });
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function installListeners() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener(
    "click",
    (ev) => {
      const t = deepestMatching(ev.target, "click");
      if (t) fire(t, "click", "sound-on-click", ev);
    },
    true
  );

  // mouseenter doesn't bubble; emulate via mouseover with relatedTarget check.
  document.addEventListener(
    "mouseover",
    (ev) => {
      const target = ev.target;
      if (
        target &&
        target.nodeType === 1 &&
        target !== ev.relatedTarget &&
        (!ev.relatedTarget || !target.contains(ev.relatedTarget))
      ) {
        const t = deepestMatching(target, "enter");
        if (t) fire(t, "enter", "sound-on-enter", ev);
      }
    },
    true
  );

  document.addEventListener(
    "focus",
    (ev) => {
      const t = deepestMatching(ev.target, "focus");
      if (t) fire(t, "focus", "sound-on-focus", ev);
    },
    true
  );

  document.addEventListener(
    "input",
    (ev) => {
      const t = deepestMatching(ev.target, "input");
      if (t) fire(t, "input", "sound-on-input", ev);
    },
    true
  );
}

export function bindRoot() {
  installListeners();
  // Also discover any elements eligible for IntersectionObserver-based
  // :on-appear / :on-leave delivery, plus watch for new ones.
  scanForAppearTargets();
  startAppearMutationObserver();
}
