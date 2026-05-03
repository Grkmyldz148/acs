// ACS language extension entry point.
//
// Provides:
//   - Document formatter (Shift+Alt+F).
//   - Context-aware CompletionItemProvider (knows whether you are at the
//     top level, inside an @sound block, or inside a layer block, and
//     suggests the right keys / values for that position).
//   - HoverProvider — every property, layer-key, preset, room, mood, etc.
//     has a markdown summary that pops up on hover.
//
// Source of truth for ALL metadata is the CATALOG below — the completion
// provider, hover provider, and the auxiliary "PROPERTIES / VALUES" lists
// are all derived from it. To document a new property, add it to CATALOG.

// ---------------------------------------------------------------------------
// Metadata catalog
// ---------------------------------------------------------------------------

// Each value entry: { value, doc }. `doc` is a single line of plain text or
// markdown — kept short so the hover popup stays scannable.

const PRESETS = [
  // percussion
  { value: "click",         doc: "Crisp UI click (modal 1.2 kHz). Generic interaction." },
  { value: "click-soft",    doc: "Softer click — lower volume, rounded high end." },
  { value: "tap",           doc: "Short tactile tap. Works for menu items, list rows." },
  { value: "tap-tactile",   doc: "Heavier rubbery tap with a low-end thump." },
  { value: "tick",          doc: "Tiny high-pitched tick. Hover / cursor moves." },
  { value: "pop",           doc: "Short bubbly pop. Primary buttons, confirm." },
  { value: "knock",         doc: "Wood-block knock — modal body, no metallic ring." },
  { value: "thunk",         doc: "Low dull thunk. Modal close, dismiss." },
  { value: "kick",          doc: "Low drum kick (55 Hz body)." },
  { value: "snare",         doc: "Drum snare — modal body + filtered noise crack." },
  { value: "hat",           doc: "Closed hi-hat — modal high partials + filtered noise." },
  { value: "clap",          doc: "Hand clap — three filtered-noise bursts." },
  { value: "woodblock",     doc: "Pitched woodblock." },

  // tonal
  { value: "bell",          doc: "Modal bell with inharmonic partials." },
  { value: "bell-soft",     doc: "Soft mellow bell — fewer partials, longer decay." },
  { value: "bell-bright",   doc: "Bright bell — extra high partials." },
  { value: "old-bell",      doc: "Aged bell — detuned partials, slow decay." },
  { value: "chime",         doc: "Wind-chime style — clean harmonic stack." },
  { value: "chime-soft",    doc: "Softer chime — gentler attack." },
  { value: "glass",         doc: "Glassy ping — high modal, short decay." },
  { value: "ting",          doc: "Tiny metallic ting." },
  { value: "gong",          doc: "Long, low gong with shimmer." },
  { value: "ping",          doc: "Single bright modal ping." },
  { value: "pluck-soft",    doc: "Karplus-Strong soft pluck." },
  { value: "pluck-bright",  doc: "Bright pluck — higher KS brightness." },
  { value: "string",        doc: "Sustained KS string." },

  // semantic / status
  { value: "success",       doc: "Two-note ascending — task complete." },
  { value: "complete",      doc: "Single confirming chord." },
  { value: "confirm",       doc: "Soft affirmative." },
  { value: "error",         doc: "Two-note descending — failure." },
  { value: "denied",        doc: "Short buzz — action denied." },
  { value: "prompt",        doc: "Prompt / question tone." },
  { value: "buzz",          doc: "Low buzz — error, invalid input." },
  { value: "notify",        doc: "Soft notification ping." },
  { value: "ding",          doc: "Single bell ding." },
  { value: "mention",       doc: "Mention / @-tag chime." },
  { value: "badge",         doc: "Brief badge / counter pop." },

  // overlays / transitions
  { value: "modal-open",    doc: "Whoosh up — overlay appears." },
  { value: "modal-close",   doc: "Whoosh down — overlay closes." },
  { value: "drawer-open",   doc: "Side drawer slide-in." },
  { value: "drawer-close",  doc: "Side drawer slide-out." },
  { value: "dropdown-open", doc: "Dropdown / menu opens." },
  { value: "dropdown-close",doc: "Dropdown / menu closes." },
  { value: "page-enter",    doc: "Page navigation — enter." },
  { value: "page-exit",     doc: "Page navigation — exit." },
  { value: "toggle-on",     doc: "Switch flip up." },
  { value: "toggle-off",    doc: "Switch flip down." },
  { value: "whoosh",        doc: "Filtered-noise sweep — generic transition." },
  { value: "swoosh",        doc: "Faster, brighter whoosh." },
  { value: "sparkle",       doc: "Random high modal sparkles." },

  // typing
  { value: "keystroke",         doc: "Single mechanical keystroke." },
  { value: "carriage-return",   doc: "Typewriter carriage return + bell." },
];

const ROOMS = [
  { value: "none",         doc: "Dry — no reverb. Inline, immediate sounds." },
  { value: "small-room",   doc: "Tight room (RT60 ≈ 0.3s). Modals, dialogs." },
  { value: "medium-room",  doc: "Normal room (RT60 ≈ 0.6s). Default for most UIs." },
  { value: "large-hall",   doc: "Concert hall (RT60 ≈ 1.5s). Cinematic, ambient." },
  { value: "chamber",      doc: "Wood chamber — short, woody decay." },
];

const MOODS = [
  { value: "warm",     doc: "Low-shelf boost, gentle high-cut. Cozy." },
  { value: "bright",   doc: "High-shelf boost. Crisp, energetic." },
  { value: "glassy",   doc: "Resonant high-mid peak. Crystalline." },
  { value: "metallic", doc: "Hard high-Q resonance. Edgy, machine-like." },
  { value: "organic",  doc: "Soft high-cut, slight low-warmth. Natural." },
  { value: "punchy",   doc: "Mid bump + transient enhance. Drum-bus feel." },
  { value: "retro",    doc: "Bandlimit + bit-reduce. Old-tech vibe." },
  { value: "airy",     doc: "Top-end shelf + room blend. Open, spacious." },
  { value: "lofi",     doc: "Lowpass + saturation. Tape-cassette character." },
];

const WAVES  = [
  { value: "sine",     doc: "Pure tone. Smooth, neutral." },
  { value: "square",   doc: "Hollow / chiptune (odd harmonics)." },
  { value: "sawtooth", doc: "Bright, buzzy (all harmonics)." },
  { value: "triangle", doc: "Soft square-ish (odd harmonics, fast rolloff)." },
];

const NOISES = [
  { value: "white", doc: "Equal energy per Hz. Bright, hissy." },
  { value: "pink",  doc: "−3 dB/oct. Warmer, balanced." },
  { value: "brown", doc: "−6 dB/oct. Deep, rumbly." },
];

const FILTERS = [
  { value: "lowpass",   doc: "Pass low / cut high. Soften brightness." },
  { value: "highpass",  doc: "Pass high / cut low. Remove rumble." },
  { value: "bandpass",  doc: "Narrow band around cutoff. Telephone-like." },
  { value: "lowshelf",  doc: "Shelf boost/cut below cutoff." },
  { value: "highshelf", doc: "Shelf boost/cut above cutoff." },
  { value: "peaking",   doc: "Bell-shaped boost/cut at cutoff (uses q)." },
  { value: "notch",     doc: "Reject narrow band at cutoff." },
  { value: "allpass",   doc: "Phase shift only — no magnitude change." },
];

// PROPERTY catalog. `scope`:
//   "global"  — only on :root
//   "any"     — on any selector
//   "layer"   — only inside @sound { layer { ... } }
//   "media"   — only inside @media (...)

const PROPS = [
  // ---- top-level: source dispatchers ----
  { name: "sound",            scope: "any",
    doc: "Trigger a sound. Default event = click. Value: built-in / @sound preset name, `synth(...)`, or `none`.",
    values: [{ value: "none", doc: "Disable sound on this element." }, ...PRESETS] },

  { name: "sound-on-click",   scope: "any", doc: "Play preset on `click`.",  values: PRESETS },
  { name: "sound-on-enter",   scope: "any", doc: "Play preset on pointer-enter (hover).", values: PRESETS },
  { name: "sound-on-leave",   scope: "any", doc: "Play preset on pointer-leave.", values: PRESETS },
  { name: "sound-on-focus",   scope: "any", doc: "Play preset on focus.", values: PRESETS },
  { name: "sound-on-input",   scope: "any", doc: "Play preset on every input event (per keystroke for text fields).", values: PRESETS },
  { name: "sound-on-appear",  scope: "any", doc: "Play preset when element enters viewport (IntersectionObserver).", values: PRESETS },
  { name: "sound-on-submit",  scope: "any", doc: "Play preset when form is submitted.", values: PRESETS },

  { name: "sound-delay",      scope: "any", doc: "Delay before playback. e.g. `120ms`, `0.2s`." },
  { name: "sound-animation",  scope: "any", doc: "Shorthand to bind a `@sound-keyframes` track to an element." },

  // ---- level / tone ----
  { name: "volume",           scope: "any", doc: "Per-element gain multiplier (0 — 1). Multiplies into master.",
    values: [
      { value: "1",    doc: "Full." }, { value: "0.85", doc: "Default-ish." },
      { value: "0.7",  doc: "−3 dB."  }, { value: "0.5",  doc: "Half-loud." },
      { value: "0.3",  doc: "Background." }, { value: "0", doc: "Mute." },
    ] },
  { name: "master-volume",    scope: "global", doc: "Global output gain. Use only on `:root`. 0 — 1.",
    values: [
      { value: "1", doc: "Full output." }, { value: "0.85", doc: "Recommended default — leaves headroom." },
      { value: "0.7", doc: "−3 dB safety pad." }, { value: "0", doc: "Mute everything (e.g. accessibility)." },
    ] },
  { name: "quality", scope: "global", doc: "Global CPU/quality knob. `low` shortens reverb tails and caps modal partials at 3 + voice pool at 4. `high` widens the voice pool to 16. Use only on `:root`.",
    values: [
      { value: "low",    doc: "Mobile-friendly: 3 partials, 4 voices, 0.6× reverb length." },
      { value: "medium", doc: "Default — 16 partials, 8 voices, full reverb." },
      { value: "high",   doc: "Spam-tolerant: 16 partials, 16 voices, full reverb." },
    ] },
  { name: "background-volume", scope: "global", doc: "Default volume for `background-sound` sources (long-running ambient).",
    values: [{ value: "0.3", doc: "Comfortable bed level." }, { value: "0.5", doc: "Foreground bed." }] },
  { name: "pitch",            scope: "any", doc: "Pitch shift. `±N st` (semitones).",
    values: [
      { value: "+2st", doc: "Slightly higher." }, { value: "-2st", doc: "Slightly lower." },
      { value: "+5st", doc: "Major-fourth up." }, { value: "+12st", doc: "Octave up." },
      { value: "-12st", doc: "Octave down." },
    ] },
  { name: "playback-rate",    scope: "any", doc: "Sample playback rate. 1 = normal; 2 = double-speed (and pitched up)." },

  // ---- spatial ----
  { name: "pan",              scope: "any", doc: "Stereo position. `-1` = far left, `+1` = far right, `auto` = element x position.",
    values: [
      { value: "auto", doc: "Auto-pan from element's screen-x position." },
      { value: "-1",   doc: "Far left." }, { value: "0", doc: "Centre." }, { value: "1", doc: "Far right." },
    ] },
  { name: "distance",         scope: "any", doc: "Apparent distance (0 = close, 1 = far). Reduces volume + adds high-cut." },

  // ---- room / reverb ----
  { name: "room",             scope: "any", doc: "Acoustic environment for sounds in this scope.", values: ROOMS },
  { name: "room-mix",         scope: "any", doc: "Wet/dry mix override for the room (0 — 1). Higher = more reverb tail." },
  { name: "room-size",        scope: "any", doc: "Custom room size override (0 — 1)." },
  { name: "room-damping",     scope: "any", doc: "High-frequency damping in the room (0 — 1)." },

  // ---- master EQ ----
  { name: "master-eq-low",    scope: "global", doc: "Master low-shelf EQ. e.g. `+1dB`, `-2dB`.",
    values: [
      { value: "+2dB", doc: "Boost low-end."  }, { value: "+1dB", doc: "Subtle warmth." },
      { value: "0dB",  doc: "Neutral."         }, { value: "-1dB", doc: "Tighten low end." },
    ] },
  { name: "master-eq-high",   scope: "global", doc: "Master high-shelf EQ.",
    values: [
      { value: "+2dB", doc: "Sparkle / air." }, { value: "+1dB", doc: "Slight brighten." },
      { value: "0dB",  doc: "Neutral."        }, { value: "-1dB", doc: "Soften top." },
      { value: "-2dB", doc: "Dark / dampened." },
    ] },

  // ---- mood ----
  { name: "sound-mood",       scope: "any", doc: "Tonal overlay applied on top of the chosen preset.", values: MOODS },
  { name: "sound-mood-mix",   scope: "any", doc: "Wet/dry blend of `sound-mood`. `1` (default) = full mood, `0` = bypass. Useful for partial application on a subtree without a full override.",
    values: [
      { value: "0",    doc: "Bypass — same as no mood." },
      { value: "0.25", doc: "Light flavor." },
      { value: "0.5",  doc: "Half-applied." },
      { value: "0.75", doc: "Mostly applied." },
      { value: "1",    doc: "Full (default)." },
    ] },

  // ---- layer source dispatchers (inside @sound { layer { ... } }) ----
  { name: "modal", scope: "layer", doc: "Modal-synthesis IIR resonator layer. Value = fundamental frequency. Use with `ratios`, `decays`, `gains`. Adds an inharmonic strike character; for cleaner additive partials, use `tones:`." },
  { name: "tones", scope: "layer", doc: "Additive sine-sum layer. Value = fundamental frequency. Each ratio is its own sine partial with own decay envelope. Cleaner / more 'professional' than `modal:` for bell, chime, glass, notify, confirm, string." },
  { name: "pluck", scope: "layer", doc: "Karplus-Strong pluck layer. Value = fundamental frequency. Use with `brightness`, `decay`, `gain`." },
  { name: "osc",   scope: "layer", doc: "Oscillator layer. Value = wave type.", values: WAVES },
  { name: "noise", scope: "layer", doc: "Noise layer. Value = noise color.", values: NOISES },
  { name: "freq",  scope: "layer", doc: "Frequency for osc / FM-only layers. e.g. `440hz`." },
  { name: "detune", scope: "layer", doc: "Oscillator detune in cents. e.g. `-7`, `+12`." },
  { name: "start",  scope: "layer", doc: "Delay before this layer fires (relative to trigger). e.g. `0ms`, `120ms`. Used in sequenced presets for arpeggios/cascades." },
  { name: "shape",  scope: "layer", doc: "Decay-shape exponent for noise envelopes. 1 = linear, >1 = faster decay, <1 = slower." },
  { name: "saturation", scope: "layer", doc: "Soft-clip drive amount (alias of `drive`). 0 = clean, 1 = obvious." },

  // ---- layer params ----
  { name: "ratios",     scope: "layer", doc: "Modal partial ratios (space- or comma-separated). 1st = fundamental." },
  { name: "decays",     scope: "layer", doc: "Per-partial decay times (modal). Higher partials usually decay faster." },
  { name: "gains",      scope: "layer", doc: "Per-partial gain mix (modal)." },
  { name: "gain",       scope: "layer", doc: "Output gain multiplier for this layer." },
  { name: "attack",     scope: "layer", doc: "Envelope attack time. e.g. `1ms`, `0.5ms`." },
  { name: "decay",      scope: "layer", doc: "Envelope decay time (or KS overall decay). e.g. `200ms`, `0.5s`." },
  { name: "release",    scope: "layer", doc: "Alias for `decay` — release tail." },
  { name: "filter",     scope: "layer", doc: "Per-layer filter type.", values: FILTERS },
  { name: "cutoff",     scope: "layer", doc: "Filter cutoff frequency. e.g. `1500hz`, `8khz`." },
  { name: "q",          scope: "layer", doc: "Filter Q (resonance / bandwidth). 0.5 = wide, 5 = narrow." },
  { name: "drive",      scope: "layer", doc: "Soft-clip saturation amount. 0 = clean, 1 = obvious distortion." },
  { name: "brightness", scope: "layer", doc: "Karplus-Strong damping (0 — 1). 1 = bright, 0 = thumpy." },
  { name: "pitch-from", scope: "layer", doc: "Initial frequency for a glide-down to `freq`. e.g. `200hz`." },
  { name: "fm-mod",     scope: "layer", doc: "FM modulator wave. Adds harmonics to the carrier.", values: WAVES },
  { name: "fm-ratio",   scope: "layer", doc: "FM modulator-to-carrier ratio. Integer = harmonic; non-integer = inharmonic / bell-like." },
  { name: "fm-depth",   scope: "layer", doc: "FM modulation depth (in Hz)." },
  { name: "realtime",   scope: "layer", doc: "Route this layer through AudioWorklet for sub-1 ms latency. Only single-mode `modal:` or simple `pluck:` (no filter) qualify; otherwise ignored. Falls back to main-thread before the worklet finishes loading.",
    values: [{ value: "true", doc: "Opt in." }, { value: "false", doc: "Default — main-thread path." }] },

  // ---- @media features ----
  { name: "prefers-reduced-sound", scope: "media", doc: "Accessibility: user prefers less / no sound.",
    values: [{ value: "reduce", doc: "User wants reduced audio." }, { value: "no-preference", doc: "No preference." }] },
  { name: "prefers-color-scheme", scope: "media", doc: "Color scheme — adapt sonic identity to dark/light.",
    values: [{ value: "dark", doc: "Dark UI." }, { value: "light", doc: "Light UI." }] },
  { name: "input-modality",       scope: "media", doc: "Primary input device — mouse / touch / keyboard / pen.",
    values: [{ value: "keyboard", doc: "" }, { value: "touch", doc: "" }, { value: "mouse", doc: "" }, { value: "pen", doc: "" }] },
  { name: "orientation",          scope: "media", doc: "Viewport orientation.",
    values: [{ value: "landscape", doc: "" }, { value: "portrait", doc: "" }] },
];

const PSEUDOS = [
  { value: "hover",          doc: "Standard CSS — pointer is over the element." },
  { value: "focus",          doc: "Standard CSS — element has focus." },
  { value: "focus-within",   doc: "Element or descendant has focus." },
  { value: "focus-visible",  doc: "Focus from keyboard navigation." },
  { value: "active",         doc: "Element is being activated (mousedown, etc.)." },
  { value: "root",           doc: "Document root — global config goes here." },
  { value: "on-click",       doc: "ACS event — fires on click. Equivalent to `sound-on-click` shorthand." },
  { value: "on-enter",       doc: "ACS event — fires on pointer-enter." },
  { value: "on-leave",       doc: "ACS event — fires on pointer-leave." },
  { value: "on-focus",       doc: "ACS event — fires on focus." },
  { value: "on-input",       doc: "ACS event — fires on each input event." },
  { value: "on-appear",      doc: "ACS event — fires when element enters viewport." },
  { value: "on-submit",      doc: "ACS event — fires on form submit." },
  { value: "first-child",    doc: "Standard CSS." },
  { value: "last-child",     doc: "Standard CSS." },
  { value: "nth-child",      doc: "Standard CSS — `nth-child(N)`." },
  { value: "not",            doc: "Standard CSS — `not(<selector>)`." },
];

const AT_RULES = [
  { value: "sound",            doc: "Define a custom sound preset. `@sound my-name { layer { ... } }` — layers stack additively." },
  { value: "sample",           doc: "Register an audio file under a name: `@sample my-thump url(\"path/to/file.wav\");`. Use the name like any preset (`sound: my-thump;`). Buffer is fetched + cached on first trigger." },
  { value: "sound-keyframes",  doc: "Time-based sound track. Use with `sound-animation` to play sequences." },
  { value: "media",            doc: "Standard media query. Most useful for `(prefers-reduced-sound: reduce)`." },
  { value: "supports",         doc: "Standard `@supports` feature query." },
  { value: "import",           doc: "Import another `.acs` stylesheet." },
  { value: "keyframes",        doc: "Standard CSS keyframes (kept for parity)." },
];

// Common layer names used in defaults.acs — useful at the top of an
// @sound block as a quick-start.
const COMMON_LAYER_NAMES = [
  { value: "body",    doc: "Main body of the sound — usually the modal/pluck core." },
  { value: "click",   doc: "Transient click on top." },
  { value: "ring",    doc: "Long ringing tail." },
  { value: "crack",   doc: "Filtered-noise crack (snares, hand-claps)." },
  { value: "strike",  doc: "Initial strike transient." },
  { value: "plateau", doc: "Sustained plateau / body section." },
  { value: "burst",   doc: "Quick filtered-noise burst." },
  { value: "metal",   doc: "Metallic-modal partials." },
  { value: "ping",    doc: "Bright tonal ping layer." },
  { value: "string",  doc: "Karplus-Strong string layer." },
];

// Indexes derived from CATALOG ---------------------------------------------

const PROPS_BY_NAME = Object.fromEntries(PROPS.map((p) => [p.name, p]));
const PRESETS_BY_NAME = Object.fromEntries(PRESETS.map((p) => [p.value, p]));
const ROOMS_BY_NAME = Object.fromEntries(ROOMS.map((r) => [r.value, r]));
const MOODS_BY_NAME = Object.fromEntries(MOODS.map((m) => [m.value, m]));
const WAVES_BY_NAME = Object.fromEntries(WAVES.map((w) => [w.value, w]));
const NOISES_BY_NAME = Object.fromEntries(NOISES.map((n) => [n.value, n]));
const FILTERS_BY_NAME = Object.fromEntries(FILTERS.map((f) => [f.value, f]));
const PSEUDOS_BY_NAME = Object.fromEntries(PSEUDOS.map((p) => [p.value, p]));
const AT_RULES_BY_NAME = Object.fromEntries(AT_RULES.map((a) => [a.value, a]));

// ---------------------------------------------------------------------------
// Formatter (unchanged from 0.3.0)
// ---------------------------------------------------------------------------

function splitDecls(body) {
  const out = [];
  let pdepth = 0;
  let bdepth = 0;
  let buf = "";
  for (const c of body) {
    if (c === "(") { pdepth++; buf += c; continue; }
    if (c === ")") { pdepth--; buf += c; continue; }
    if (c === "{") { bdepth++; buf += c; continue; }
    if (c === "}") { bdepth--; buf += c; continue; }
    if (c === ";" && pdepth === 0 && bdepth === 0) {
      const t = buf.trim();
      if (t) out.push(t);
      buf = "";
      continue;
    }
    buf += c;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

function matchBrace(src, open) {
  let depth = 1;
  let j = open + 1;
  const len = src.length;
  while (j < len && depth > 0) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") depth--;
    if (depth > 0) j++;
  }
  return j;
}

function bodyHasNestedBlock(body) {
  let pdepth = 0;
  let bdepth = 0;
  for (const c of body) {
    if (c === "(") pdepth++;
    else if (c === ")") pdepth--;
    else if (c === "{" && pdepth === 0 && bdepth === 0) return true;
    else if (c === "{") bdepth++;
    else if (c === "}") bdepth--;
  }
  return false;
}

function formatBlock(src, indent = "") {
  let out = "";
  let i = 0;
  const len = src.length;
  const atTop = indent === "";

  while (i < len) {
    while (i < len && /\s/.test(src[i])) i++;
    if (i >= len) break;

    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) { out += indent + src.slice(i).trim() + "\n"; break; }
      const block = src.slice(i, end + 2);
      out += block
        .split("\n")
        .map((l, idx) => (idx === 0 ? indent + l.trim() : indent + " " + l.trim()))
        .join("\n") + "\n";
      i = end + 2;
      while (i < len && /\s/.test(src[i])) {
        if (src[i] === "\n") { i++; break; }
        i++;
      }
      continue;
    }

    let k = i;
    let pdepth = 0;
    let nextSemi = -1;
    let nextBrace = -1;
    while (k < len) {
      const c = src[k];
      if (c === "(") pdepth++;
      else if (c === ")") pdepth--;
      else if (pdepth === 0) {
        if (c === ";") { nextSemi = k; break; }
        if (c === "{") { nextBrace = k; break; }
        if (c === "}") break;
      }
      k++;
    }

    if (nextSemi !== -1 && (nextBrace === -1 || nextSemi < nextBrace)) {
      const decl = src.slice(i, nextSemi).trim();
      if (decl) out += `${indent}${decl};\n`;
      i = nextSemi + 1;
      continue;
    }

    if (nextBrace === -1) {
      const rest = src.slice(i).trim();
      if (rest) out += indent + rest + "\n";
      break;
    }

    const selector = src.slice(i, nextBrace).trim();
    const close = matchBrace(src, nextBrace);
    const body = src.slice(nextBrace + 1, close);

    if (bodyHasNestedBlock(body)) {
      out += `${indent}${selector} {\n`;
      out += formatBlock(body, indent + "  ");
      out += `${indent}}\n`;
      out += atTop ? "\n" : "";
    } else {
      const decls = splitDecls(body);
      out += `${indent}${selector} {\n`;
      for (const d of decls) out += `${indent}  ${d};\n`;
      out += `${indent}}\n`;
      out += atTop ? "\n" : "";
    }

    i = close + 1;
  }

  return out;
}

function format(src) {
  return formatBlock(src).trim() + "\n";
}

// ---------------------------------------------------------------------------
// Position / context analyzer
// ---------------------------------------------------------------------------

// Strip block comments so brace counting isn't fooled by `/* { */`.
function stripComments(src) {
  let out = "";
  let i = 0;
  const len = src.length;
  while (i < len) {
    if (src[i] === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) { out += " ".repeat(len - i); break; }
      out += " ".repeat(end + 2 - i);
      i = end + 2;
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

// Walk the source up to `offset` and figure out:
//   inMedia       — top context is @media
//   inSoundBlock  — direct parent is @sound
//   inLayerBlock  — direct parent is a layer (i.e. nested rule inside @sound)
function analyzeContext(rawSrc, offset) {
  const src = stripComments(rawSrc).slice(0, offset);

  // Walk left-to-right, maintaining a stack of selectors for each open `{`.
  const stack = [];
  let i = 0;
  let selBuf = "";
  let pdepth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "(") { pdepth++; selBuf += c; i++; continue; }
    if (c === ")") { pdepth--; selBuf += c; i++; continue; }
    if (pdepth > 0) { selBuf += c; i++; continue; }

    if (c === "{") {
      stack.push(selBuf.trim());
      selBuf = "";
    } else if (c === "}") {
      stack.pop();
      selBuf = "";
    } else if (c === ";") {
      selBuf = "";
    } else {
      selBuf += c;
    }
    i++;
  }

  const top = stack[0] || "";
  const direct = stack[stack.length - 1] || "";
  const inMedia = /^@media\b/i.test(top) || stack.some((s) => /^@media\b/i.test(s));
  const isSoundBlock = (s) => /^@sound\b/i.test(s);
  const inSoundBlock = stack.some(isSoundBlock);
  const directIsSound = isSoundBlock(direct);
  // Layer block = direct parent is non-empty, non-at-rule, and the chain
  // includes an @sound somewhere above.
  const inLayerBlock = inSoundBlock && !directIsSound && direct !== "" && !direct.startsWith("@");

  return {
    stack,
    selectorBuf: selBuf,
    inMedia,
    inSoundBlock,
    directIsSound,
    inLayerBlock,
    atTopLevel: stack.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

function buildCompletionProvider(vscode) {
  const Item = vscode.CompletionItem;
  const Kind = vscode.CompletionItemKind;
  const MD = vscode.MarkdownString;

  function md(text) {
    if (!text) return undefined;
    const m = new MD(text);
    m.supportThemeIcons = false;
    return m;
  }

  function valueItem(entry, propDoc) {
    const it = new Item(entry.value, Kind.Value);
    if (propDoc) it.detail = propDoc;
    if (entry.doc) it.documentation = md(entry.doc);
    return it;
  }
  function propItem(entry) {
    const it = new Item(entry.name, Kind.Property);
    it.insertText = new vscode.SnippetString(`${entry.name}: $0;`);
    if (entry.doc) {
      it.documentation = md(entry.doc);
      it.detail = entry.doc.split(".")[0]; // short blurb
    }
    return it;
  }
  function pseudoItem(entry) {
    const it = new Item(entry.value, Kind.Keyword);
    it.detail = "pseudo-class";
    if (entry.doc) it.documentation = md(entry.doc);
    return it;
  }
  function atRuleItem(entry) {
    const it = new Item(`@${entry.value}`, Kind.Keyword);
    it.detail = "at-rule";
    if (entry.doc) it.documentation = md(entry.doc);
    return it;
  }
  function layerNameItem(entry) {
    const it = new Item(entry.value, Kind.Class);
    it.detail = "layer name (convention)";
    if (entry.doc) it.documentation = md(entry.doc);
    it.insertText = new vscode.SnippetString(`${entry.value} {\n\t$0\n}`);
    return it;
  }

  function valueCompletions(propName) {
    const p = PROPS_BY_NAME[propName.toLowerCase()];
    if (!p || !p.values) return null;
    return p.values.map((v) => valueItem(v, p.doc));
  }

  return {
    provideCompletionItems(document, position) {
      const offset = document.offsetAt(position);
      const lineText = document.lineAt(position.line).text;
      const before = lineText.slice(0, position.character);
      const ctx = analyzeContext(document.getText(), offset);

      // 1) Property *value* completion.
      //    The "owning" property is whichever `name:` is closest to the
      //    cursor and not separated by a comma (inline ACS) or `;`.
      //    Example: in `body: noise: white, █` the comma resets us — the
      //    cursor is at the start of a new key/value pair, not inside a
      //    value, so we fall through to property-name completion.
      const lastCommaInLine = before.lastIndexOf(",");
      const segAfterBoundary = before.slice(Math.max(
        lastCommaInLine,
        before.lastIndexOf(";"),
        before.lastIndexOf("{"),
      ) + 1);
      // Tail can't contain `:` — that would mean another `name:` lies
      // between us and the cursor, so the closer one owns the position.
      const valMatch = segAfterBoundary.match(/([a-zA-Z][\w-]*)\s*:\s*([^;{},:]*)$/);
      // At the top level (outside any block) a `name:` is part of a
      // selector pseudo-class, not a property declaration. Skip the
      // value-completion branch in that case so pseudo completion fires.
      if (valMatch && !ctx.atTopLevel) {
        const prop = valMatch[1].toLowerCase();
        const tail = valMatch[2];
        const lastTok = tail.split(/[\s]+/).pop() || "";
        const startOfTok = tail === "" || /\s$/.test(tail) || /^[+\-]?[\w.]*$/.test(lastTok);
        if (!startOfTok) return undefined;

        const items = valueCompletions(prop);
        if (items) return items;
        // If the property isn't in our catalog (e.g. user-defined layer
        // name `body`, `crack`, ...), fall through to property-name
        // completion so the next layer key is suggested.
      }

      // 2) At-rule: `@<cursor>` at start of line (whitespace allowed).
      if (/(^|\s)@([a-zA-Z-]*)$/.test(before) && (ctx.atTopLevel || ctx.inMedia || ctx.inSoundBlock)) {
        return AT_RULES.map(atRuleItem);
      }

      // 3) Pseudo-class: `:` either at start, after a selector-boundary
      //    char (whitespace, comma, combinator, paren, bracket), OR
      //    immediately after an identifier — but only at top level
      //    (selector position), since inside a body it would be a property.
      const pseudoBoundary = /(^|[\s,>+~()\[\]])(:)([a-zA-Z-]*)$/.test(before);
      const pseudoAfterIdent = /[a-zA-Z][\w-]*(:)([a-zA-Z-]*)$/.test(before);
      if (pseudoBoundary || (pseudoAfterIdent && ctx.atTopLevel)) {
        return PSEUDOS.map(pseudoItem);
      }

      // 4) Property *name* / layer-name completion.
      // Heuristic: at start of line (whitespace + optional partial ident) and
      // we're not currently in a value position.
      const lastColon = before.lastIndexOf(":");
      const lastBoundary = Math.max(before.lastIndexOf("{"), before.lastIndexOf(";"), before.lastIndexOf(","));
      const inValuePos = lastColon > lastBoundary;
      if (inValuePos) return undefined;

      // Only the segment after the last boundary (`{`, `;`, `,`) needs to
      // look like "whitespace + maybe a partial ident". This makes
      // completion work mid-line inside the inline ACS form, e.g.
      // `body: noise: white, █` — the segment after `,` is empty/ident.
      const segment = before.slice(lastBoundary + 1);
      if (!/^\s*([a-zA-Z-][\w-]*)?$/.test(segment)) return undefined;

      // Pick the right slate of properties for this position.
      let entries;
      // After a `,` on the current line, the inline ACS form is being
      // continued — the user is starting another `key: value` for the
      // SAME layer, so only layer params are useful (no layer names, no
      // re-issue of the source dispatcher).
      const afterCommaInline = lastCommaInLine !== -1 &&
        lastCommaInLine > before.lastIndexOf(";") &&
        lastCommaInLine > before.lastIndexOf("{");
      if (ctx.directIsSound && !afterCommaInline) {
        // Top-level position inside `@sound name { ... }`. Suggest layer
        // names (convention) AND layer source dispatchers (inline form).
        entries = [
          ...COMMON_LAYER_NAMES.map(layerNameItem),
          ...PROPS.filter((p) => p.scope === "layer").map(propItem),
        ];
        return entries;
      }
      if (ctx.directIsSound && afterCommaInline) {
        // Inline form continuation — only layer params, and exclude the
        // source dispatchers (only one source per layer).
        const dispatchers = new Set(["modal", "pluck", "osc", "noise", "freq"]);
        return PROPS
          .filter((p) => p.scope === "layer" && !dispatchers.has(p.name))
          .map(propItem);
      }
      if (ctx.inLayerBlock) {
        entries = PROPS.filter((p) => p.scope === "layer").map(propItem);
        return entries;
      }
      if (ctx.inMedia && !ctx.inSoundBlock) {
        // inside @media (...) {...} — once inside the rule body we want
        // top-level props; the media-feature names are only relevant inside
        // the parens, which is harder to detect cheaply.
        entries = PROPS.filter((p) => p.scope === "any" || p.scope === "global").map(propItem);
        return entries;
      }
      // Top-level / regular selector body.
      entries = PROPS.filter((p) => p.scope === "any" || p.scope === "global").map(propItem);
      return entries;
    },
  };
}

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

function buildHoverProvider(vscode) {
  const MD = vscode.MarkdownString;

  function fmt(title, kind, body, valuesList) {
    const md = new MD();
    md.appendMarkdown(`**${title}** _${kind}_\n\n`);
    if (body) md.appendMarkdown(body + "\n");
    if (valuesList && valuesList.length) {
      md.appendMarkdown("\n---\n**Values:**\n\n");
      for (const v of valuesList) {
        md.appendMarkdown(`- \`${v.value}\`${v.doc ? ` — ${v.doc}` : ""}\n`);
      }
    }
    return md;
  }

  function lookup(word, lineText, charPos) {
    const w = word.toLowerCase();

    // @-rules show up as two tokens (`@`, `name`) — vscode's getWordRange
    // picks just the name. Detect leading `@`.
    const before = lineText.slice(0, charPos - word.length);
    if (/@$/.test(before.trim()) || /@[a-zA-Z-]*$/.test(lineText.slice(0, charPos))) {
      const at = AT_RULES_BY_NAME[w];
      if (at) return fmt(`@${w}`, "at-rule", at.doc);
    }

    // Pseudo-class — preceded by `:` and not a property assignment.
    const beforeWord = lineText.slice(0, charPos - word.length);
    const isPseudo =
      /[\s,>+~()\[\]]:[a-zA-Z-]*$/.test(beforeWord + word) &&
      !/[a-zA-Z][\w-]*\s*:\s*[a-zA-Z-]*$/.test(beforeWord + word);
    if (isPseudo) {
      const ps = PSEUDOS_BY_NAME[w];
      if (ps) return fmt(`:${w}`, "pseudo-class", ps.doc);
    }

    // Property?
    const p = PROPS_BY_NAME[w];
    if (p) return fmt(p.name, `property (${p.scope})`, p.doc, p.values);

    // Value families?
    if (PRESETS_BY_NAME[w]) return fmt(w, "preset", PRESETS_BY_NAME[w].doc);
    if (ROOMS_BY_NAME[w])   return fmt(w, "room",   ROOMS_BY_NAME[w].doc);
    if (MOODS_BY_NAME[w])   return fmt(w, "mood",   MOODS_BY_NAME[w].doc);
    if (WAVES_BY_NAME[w])   return fmt(w, "wave",   WAVES_BY_NAME[w].doc);
    if (NOISES_BY_NAME[w])  return fmt(w, "noise",  NOISES_BY_NAME[w].doc);
    if (FILTERS_BY_NAME[w]) return fmt(w, "filter", FILTERS_BY_NAME[w].doc);

    return null;
  }

  return {
    provideHover(document, position) {
      const range = document.getWordRangeAtPosition(position, /[A-Za-z][\w-]*/);
      if (!range) return null;
      const word = document.getText(range);
      const line = document.lineAt(position.line).text;
      const md = lookup(word, line, range.end.character);
      if (!md) return null;
      return new vscode.Hover(md, range);
    },
  };
}

// ---------------------------------------------------------------------------
// Linter — DiagnosticCollection with the same checks as tools/lint-acs.mjs
// ---------------------------------------------------------------------------

// Build flat sets of valid identifiers from the CATALOG so the linter
// produces the same warnings as the CLI lint, without re-listing them.
const VALID_TOPLEVEL = new Set(
  PROPS.filter((p) => p.scope === "any" || p.scope === "global").map((p) => p.name)
);
const VALID_LAYER_KEYS = new Set([
  ...PROPS.filter((p) => p.scope === "layer").map((p) => p.name),
  // Layer-scoped uses of properties that also exist at top level.
  "pan",
]);
const VALID_PRESETS = new Set(PRESETS.map((p) => p.value));
const VALID_ROOMS = new Set(ROOMS.map((r) => r.value));
const VALID_MOODS = new Set(MOODS.map((m) => m.value));
const VALID_WAVES = new Set(WAVES.map((w) => w.value));
const VALID_NOISES = new Set(NOISES.map((n) => n.value));
const VALID_FILTERS = new Set([
  ...FILTERS.map((f) => f.value),
  // tpt-* prefixed variants opt into TPT-SVF topology in dsp.js.
  "tpt-lp", "tpt-hp", "tpt-bp", "tpt-notch", "tpt-peak",
]);

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const prev = new Array(n + 1);
  for (let i = 0; i <= n; i++) prev[i] = i;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev[0] = i;
    for (let j = 1; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

function suggestFor(needle, set) {
  let best = null, score = Infinity;
  const lc = needle.toLowerCase();
  for (const k of set) {
    const d = levenshtein(lc, k);
    if (d < score && d <= Math.max(2, Math.floor(k.length / 3))) {
      score = d; best = k;
    }
  }
  return best;
}

// Run the lint pass over a full document. Returns an array of diagnostic
// descriptors `{startLine, startCol, endLine, endCol, severity, message}`
// the activate() shell will convert into vscode.Diagnostic instances.
function lintDocument(text) {
  const diags = [];
  const stripped = stripComments(text);

  // Walk line by line. For each line determine context via analyzeContext
  // at the line's first non-whitespace offset, then scan property: value
  // pairs.
  const lines = text.split(/\r?\n/);
  let runningOffset = 0;
  const lineOffsets = lines.map((l) => {
    const o = runningOffset;
    runningOffset += l.length + 1;
    return o;
  });

  for (let li = 0; li < lines.length; li++) {
    const rawLine = lines[li];
    // Mask out parenthesized regions — synth(osc: sine, freq: 440hz)
    // contains `key:` pairs that aren't top-level decls. Replace with
    // spaces so column offsets stay aligned for diagnostic ranges.
    let line = "";
    {
      let depth = 0;
      for (const c of rawLine) {
        if (c === "(") depth++;
        if (depth > 0) line += " ";
        else line += c;
        if (c === ")") depth = Math.max(0, depth - 1);
      }
    }
    const trimmed = line.trim();
    if (!trimmed || /^\/\//.test(trimmed) || /^\/\*/.test(trimmed)) continue;
    // Skip pure brace lines and selectors.
    if (/^[}{]+\s*$/.test(trimmed)) continue;

    // Match `key: value [;,]?` — value runs until `;`, end-of-line, or
    // a comma followed by another `key:` on the same line (inline form).
    // For diagnostics we just want the key span and the value text.
    const declRe = /([a-zA-Z][\w-]*)\s*:\s*([^;]*?)(?=;|,\s*[a-zA-Z][\w-]*\s*:|$)/g;
    let m;
    while ((m = declRe.exec(line)) !== null) {
      const key = m[1];
      const valRaw = m[2].trim();
      const keyStart = m.index;
      const keyEnd = keyStart + key.length;

      // Determine context at the key's position via stripped + offset.
      const absOffset = lineOffsets[li] + keyStart;
      // analyzeContext expects raw text; it strips internally.
      const ctx = analyzeContext(text, absOffset);

      // Top-level (no open block) — `name:` is part of a selector
      // pseudo-class, not a property. Skip.
      if (ctx.atTopLevel) continue;

      // Inside @sound directly — `name:` could be the inline-form layer
      // declaration like `body: noise: white, ...` OR it could be a
      // layer key inside a layer block. analyzeContext handles this:
      // directIsSound vs inLayerBlock. For a top-level `@sound` body,
      // the FIRST `key` on a line is a layer name (any name allowed —
      // e.g. user picks `body`, `crack`, `metal`); subsequent inline
      // pairs are layer keys. For nested layer blocks, every key is
      // a layer key.
      let validSet, kind;
      if (ctx.directIsSound) {
        // Inline form. The first decl on the line names a layer (any
        // identifier ok); subsequent decls are layer keys (must be in
        // VALID_LAYER_KEYS). m.index === 0 means we're at the first decl.
        // (Whitespace-only prefix counts as "first.")
        const before = line.slice(0, keyStart);
        const isFirst = /^\s*$/.test(before);
        if (isFirst) continue; // layer name — anything allowed
        validSet = VALID_LAYER_KEYS;
        kind = "layer key";
      } else if (ctx.inLayerBlock) {
        validSet = VALID_LAYER_KEYS;
        kind = "layer key";
      } else if (ctx.inMedia && /^\s*\(/.test(line.slice(0, keyStart).replace(/[^(]+$/, ""))) {
        // Inside `@media (foo: bar)` — feature query, skip.
        continue;
      } else {
        validSet = VALID_TOPLEVEL;
        kind = "property";
      }

      if (!validSet.has(key)) {
        const hint = suggestFor(key, validSet);
        diags.push({
          startLine: li,
          startCol: keyStart,
          endLine: li,
          endCol: keyEnd,
          severity: "warning",
          message: `unknown ${kind} "${key}"` + (hint ? ` — did you mean "${hint}"?` : ""),
        });
        continue; // don't bother validating value of an unknown key
      }

      // Value-side checks for known keys.
      if (validSet === VALID_TOPLEVEL) {
        if (key === "sound-mood" && valRaw && !VALID_MOODS.has(valRaw)) {
          const h = suggestFor(valRaw, VALID_MOODS);
          diags.push({
            startLine: li, startCol: line.indexOf(valRaw, keyEnd),
            endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
            severity: "warning",
            message: `unknown mood "${valRaw}"` + (h ? ` — did you mean "${h}"?` : ""),
          });
        }
        if (key === "room" && valRaw && !VALID_ROOMS.has(valRaw) && valRaw !== "plate") {
          const h = suggestFor(valRaw, VALID_ROOMS);
          diags.push({
            startLine: li, startCol: line.indexOf(valRaw, keyEnd),
            endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
            severity: "warning",
            message: `unknown room "${valRaw}"` + (h ? ` — did you mean "${h}"?` : ""),
          });
        }
        if (key === "volume") {
          const v = parseFloat(valRaw);
          if (isFinite(v) && (v < 0 || v > 2)) {
            diags.push({
              startLine: li, startCol: line.indexOf(valRaw, keyEnd),
              endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
              severity: "warning",
              message: `volume=${v} out of usable range [0..2]`,
            });
          }
        }
      } else {
        // Layer key value checks.
        if (key === "noise" && valRaw && !VALID_NOISES.has(valRaw)) {
          diags.push({
            startLine: li, startCol: line.indexOf(valRaw, keyEnd),
            endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
            severity: "warning",
            message: `unknown noise "${valRaw}" — expected white | pink`,
          });
        }
        if (key === "osc" && valRaw && !VALID_WAVES.has(valRaw)) {
          const h = suggestFor(valRaw, VALID_WAVES);
          diags.push({
            startLine: li, startCol: line.indexOf(valRaw, keyEnd),
            endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
            severity: "warning",
            message: `unknown osc "${valRaw}"` + (h ? ` — did you mean "${h}"?` : ""),
          });
        }
        if (key === "filter" && valRaw && !VALID_FILTERS.has(valRaw)) {
          const h = suggestFor(valRaw, VALID_FILTERS);
          diags.push({
            startLine: li, startCol: line.indexOf(valRaw, keyEnd),
            endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
            severity: "warning",
            message: `unknown filter "${valRaw}"` + (h ? ` — did you mean "${h}"?` : ""),
          });
        }
        if (key === "q") {
          const v = parseFloat(valRaw);
          if (isFinite(v) && v > 4) {
            diags.push({
              startLine: li, startCol: line.indexOf(valRaw, keyEnd),
              endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
              severity: "information",
              message: `q=${v} likely whistles (recommended < 2)`,
            });
          }
        }
        if (key === "gain") {
          const v = parseFloat(valRaw);
          if (isFinite(v) && v > 2.5) {
            diags.push({
              startLine: li, startCol: line.indexOf(valRaw, keyEnd),
              endLine: li, endCol: line.indexOf(valRaw, keyEnd) + valRaw.length,
              severity: "information",
              message: `gain=${v} very high — auto-cal scales but base lower`,
            });
          }
        }
      }
    }
  }

  return diags;
}

// ---------------------------------------------------------------------------
// CodeLens — inline "Open in Picker" action above every @sound block
// ---------------------------------------------------------------------------

function buildCodeLensProvider(vscode) {
  return {
    provideCodeLenses(document) {
      const text = document.getText();
      const stripped = stripComments(text);
      const re = /@sound\s+([a-zA-Z][\w-]*)\s*\{/g;
      const lenses = [];
      let m;
      while ((m = re.exec(stripped)) !== null) {
        const start = document.positionAt(m.index);
        const range = new vscode.Range(start, start);
        // Two CodeLenses per @sound: quick play + full picker.
        lenses.push(new vscode.CodeLens(range, {
          title: "$(play) Audition",
          command: "acs.auditionSound",
          arguments: [m[1]],
        }));
        lenses.push(new vscode.CodeLens(range, {
          title: "$(unmute) Open in Picker",
          command: "acs.openSoundPicker",
          arguments: [m[1]],
        }));
      }
      return lenses;
    },
  };
}

// ---------------------------------------------------------------------------
// DocumentSymbolProvider — populates the editor's outline view + the
// Cmd+Shift+O quick-pick. Emits one symbol per @sound, @sound-keyframes,
// @sample, and per top-level selector. @sound layers nest as children.
// ---------------------------------------------------------------------------

function buildSymbolProvider(vscode) {
  return {
    provideDocumentSymbols(document) {
      const text = document.getText();
      const stripped = stripComments(text);
      const symbols = [];

      // Walk top-level: @sound NAME { ... }, @sound-keyframes NAME { ... },
      // @sample NAME url(...);, plain selectors with bodies.
      let i = 0;
      const len = stripped.length;
      while (i < len) {
        while (i < len && /\s/.test(stripped[i])) i++;
        if (i >= len) break;

        // @sample (statement form, no body)
        const sampleM = stripped.slice(i).match(/^@sample\s+([a-zA-Z_][\w-]*)\s+url\(/);
        if (sampleM) {
          const semi = stripped.indexOf(";", i);
          if (semi < 0) break;
          const start = document.positionAt(i);
          const end = document.positionAt(semi + 1);
          const range = new vscode.Range(start, end);
          symbols.push(new vscode.DocumentSymbol(
            sampleM[1], "@sample",
            vscode.SymbolKind.File, range, range,
          ));
          i = semi + 1;
          continue;
        }

        // Block form: SELECTOR { BODY }
        const open = stripped.indexOf("{", i);
        if (open < 0) break;
        const selectorText = stripped.slice(i, open).trim();
        // Find matching close brace.
        let depth = 1, j = open + 1;
        while (j < len && depth > 0) {
          if (stripped[j] === "{") depth++;
          else if (stripped[j] === "}") depth--;
          if (depth > 0) j++;
        }
        if (depth !== 0) break;
        const start = document.positionAt(i);
        const end = document.positionAt(j + 1);
        const range = new vscode.Range(start, end);
        const selRange = new vscode.Range(start, document.positionAt(open));

        if (/^@sound\b/.test(selectorText)) {
          const name = selectorText.slice(7).trim() || "(unnamed)";
          const sym = new vscode.DocumentSymbol(
            name, "@sound",
            vscode.SymbolKind.Class, range, selRange,
          );
          // Nested layer symbols: walk inside body.
          const body = stripped.slice(open + 1, j);
          const layerRe = /([a-zA-Z_][\w-]*)\s*\{/g;
          let lm;
          while ((lm = layerRe.exec(body)) !== null) {
            const layerStart = document.positionAt(open + 1 + lm.index);
            // Find matching close
            let ld = 1, lj = open + 1 + lm.index + lm[0].length;
            while (lj < len && ld > 0) {
              if (stripped[lj] === "{") ld++;
              else if (stripped[lj] === "}") ld--;
              if (ld > 0) lj++;
            }
            if (ld === 0) {
              const layerEnd = document.positionAt(lj + 1);
              const layerRange = new vscode.Range(layerStart, layerEnd);
              sym.children.push(new vscode.DocumentSymbol(
                lm[1], "layer",
                vscode.SymbolKind.Field, layerRange, layerRange,
              ));
              layerRe.lastIndex = lj + 1 - (open + 1);
            }
          }
          symbols.push(sym);
        } else if (/^@sound-keyframes\b/.test(selectorText)) {
          const name = selectorText.slice("@sound-keyframes".length).trim() || "(unnamed)";
          symbols.push(new vscode.DocumentSymbol(
            name, "@sound-keyframes",
            vscode.SymbolKind.Function, range, selRange,
          ));
        } else if (/^@media\b/.test(selectorText)) {
          symbols.push(new vscode.DocumentSymbol(
            selectorText, "@media",
            vscode.SymbolKind.Namespace, range, selRange,
          ));
        } else {
          // Plain selector rule (button, .primary, dialog[open], …)
          symbols.push(new vscode.DocumentSymbol(
            selectorText, "rule",
            vscode.SymbolKind.Property, range, selRange,
          ));
        }
        i = j + 1;
      }
      return symbols;
    },
  };
}

// ---------------------------------------------------------------------------
// FoldingRangeProvider — collapse @sound, @sound-keyframes, @media blocks.
// ---------------------------------------------------------------------------

function buildFoldingProvider(vscode) {
  return {
    provideFoldingRanges(document) {
      const ranges = [];
      const text = document.getText();
      const stripped = stripComments(text);
      // Brace-aware walker: track open positions, emit ranges on close.
      const stack = [];
      for (let i = 0; i < stripped.length; i++) {
        const c = stripped[i];
        if (c === "{") {
          stack.push(i);
        } else if (c === "}") {
          const open = stack.pop();
          if (open === undefined) continue;
          const startLine = document.positionAt(open).line;
          const endLine = document.positionAt(i).line;
          if (endLine > startLine) {
            ranges.push(new vscode.FoldingRange(startLine, endLine));
          }
        }
      }
      return ranges;
    },
  };
}

// ---------------------------------------------------------------------------
// DocumentLinkProvider — make @sample url("...") and @import "..." paths
// clickable so Cmd+Click jumps to / opens the referenced file.
// ---------------------------------------------------------------------------

function buildLinkProvider(vscode) {
  return {
    provideDocumentLinks(document) {
      const links = [];
      const text = document.getText();
      // @sample name url("...")
      const re1 = /@sample\s+[a-zA-Z_][\w-]*\s+url\(\s*["']?([^"')]+)["']?\s*\)/g;
      let m;
      while ((m = re1.exec(text)) !== null) {
        const urlStart = m.index + m[0].indexOf(m[1]);
        const urlEnd = urlStart + m[1].length;
        const range = new vscode.Range(
          document.positionAt(urlStart),
          document.positionAt(urlEnd),
        );
        try {
          const target = m[1].startsWith("http")
            ? vscode.Uri.parse(m[1])
            : vscode.Uri.joinPath(document.uri, "..", m[1]);
          links.push(new vscode.DocumentLink(range, target));
        } catch (e) {}
      }
      // @import "path.acs"
      const re2 = /@import\s+["']([^"']+)["']/g;
      while ((m = re2.exec(text)) !== null) {
        const urlStart = m.index + m[0].indexOf(m[1]);
        const urlEnd = urlStart + m[1].length;
        const range = new vscode.Range(
          document.positionAt(urlStart),
          document.positionAt(urlEnd),
        );
        try {
          const target = vscode.Uri.joinPath(document.uri, "..", m[1]);
          links.push(new vscode.DocumentLink(range, target));
        } catch (e) {}
      }
      return links;
    },
  };
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sound Picker webview — single self-contained HTML built from poc/picker.html
// by tools/build-webview-picker.mjs (inlines the runtime + defaults.acs).
// All UI/DSP logic lives in poc/picker.html — VSCode just hosts the HTML
// and forwards "copy snippet" requests to the system clipboard.
// ---------------------------------------------------------------------------

let soundPickerPanel = null;

function openSoundPicker(context, presetName, audition = false) {
  const vscode = require("vscode");
  const fs = require("fs");
  const path = require("path");

  // Reuse the existing panel if it's already open. We still send the
  // select / audition message below so a click on a CodeLens jumps to
  // the right preset even when the panel was already focused on another.
  if (soundPickerPanel) {
    soundPickerPanel.reveal(vscode.ViewColumn.Beside);
    if (presetName) {
      soundPickerPanel.webview.postMessage({
        type: audition ? "audition" : "select",
        preset: presetName,
      });
    }
    return;
  }

  const htmlPath = path.join(context.extensionPath, "webview", "picker.html");
  let html;
  try {
    html = fs.readFileSync(htmlPath, "utf8");
  } catch (e) {
    vscode.window.showErrorMessage(
      `ACS Sound Picker: cannot load webview at ${htmlPath}. ` +
      `Run \`node tools/build-webview-picker.mjs\` to generate it.`
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "acsSoundPicker",
    "ACS Sound Picker",
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  soundPickerPanel = panel;
  panel.webview.html = html;
  panel.onDidDispose(() => { soundPickerPanel = null; });

  // Inbound messages from the picker.
  panel.webview.onDidReceiveMessage(async (msg) => {
    if (!msg) return;
    if (msg.type === "copy" && typeof msg.text === "string") {
      await vscode.env.clipboard.writeText(msg.text);
      vscode.window.setStatusBarMessage("ACS: snippet copied", 2000);
    } else if (msg.type === "ready" && presetName) {
      // Picker finished bootstrapping — send the deferred select/audition.
      panel.webview.postMessage({
        type: audition ? "audition" : "select",
        preset: presetName,
      });
    }
  });
}

function activate(context) {
  const vscode = require("vscode");

  // Formatter
  const formatProvider = {
    provideDocumentFormattingEdits(document) {
      const src = document.getText();
      let formatted;
      try {
        formatted = format(src);
      } catch (e) {
        vscode.window.showErrorMessage(`ACS format failed: ${e.message}`);
        return [];
      }
      if (formatted === src) return [];
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(src.length)
      );
      return [vscode.TextEdit.replace(fullRange, formatted)];
    },
  };

  // Linter — DiagnosticCollection updated on open / change / save.
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("acs");
  function refreshDiagnostics(document) {
    if (document.languageId !== "acs") return;
    const findings = lintDocument(document.getText());
    const diags = findings.map((f) => {
      const sev = f.severity === "warning"
        ? vscode.DiagnosticSeverity.Warning
        : f.severity === "information"
          ? vscode.DiagnosticSeverity.Information
          : vscode.DiagnosticSeverity.Error;
      const range = new vscode.Range(
        new vscode.Position(f.startLine, Math.max(0, f.startCol)),
        new vscode.Position(f.endLine, Math.max(f.startCol + 1, f.endCol))
      );
      const d = new vscode.Diagnostic(range, f.message, sev);
      d.source = "acs";
      return d;
    });
    diagnosticCollection.set(document.uri, diags);
  }
  // Lint already-open .acs documents on activation.
  vscode.workspace.textDocuments.forEach(refreshDiagnostics);

  context.subscriptions.push(
    diagnosticCollection,
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((e) => refreshDiagnostics(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri)),
    vscode.languages.registerDocumentFormattingEditProvider("acs", formatProvider),
    vscode.languages.registerCompletionItemProvider(
      { language: "acs" },
      buildCompletionProvider(vscode),
      ":", "@", " ", "-", ",", "\n"
    ),
    vscode.languages.registerHoverProvider({ language: "acs" }, buildHoverProvider(vscode)),
    vscode.languages.registerCodeLensProvider({ language: "acs" }, buildCodeLensProvider(vscode)),
    vscode.languages.registerDocumentSymbolProvider({ language: "acs" }, buildSymbolProvider(vscode)),
    vscode.languages.registerFoldingRangeProvider({ language: "acs" }, buildFoldingProvider(vscode)),
    vscode.languages.registerDocumentLinkProvider({ language: "acs" }, buildLinkProvider(vscode)),
    vscode.commands.registerCommand("acs.openSoundPicker", (preset) => openSoundPicker(context, preset)),
    vscode.commands.registerCommand("acs.auditionSound", (preset) => {
      // Quick audition — open the picker if it isn't already, then ask
      // it to play the named preset. The picker's webview HTML listens
      // for messages in `panel.webview.onDidReceiveMessage`; we extend
      // the protocol with an "audition" type below.
      openSoundPicker(context, preset, /* audition */ true);
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate, format, analyzeContext, lintDocument };
