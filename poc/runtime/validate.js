/* validate.js — friendly warnings at parse/bind/trigger time.
 *
 * Emits console.warn for likely typos / out-of-range values without
 * blocking playback. Designed to make typos discoverable without
 * making the runtime brittle. CSS-style "be forgiving but tell the
 * user".
 *
 * Warnings are deduped per session via `seenWarnings` — re-binds (theme
 * switch, hot-reload) don't re-spam the console for the same issue.
 */

const seenWarnings = new Set();
function warnOnce(key, msg) {
  if (seenWarnings.has(key)) return;
  seenWarnings.add(key);
  console.warn(msg);
}

const KNOWN_TOPLEVEL_PROPS = new Set([
  "sound",
  "sound-on-click",
  "sound-on-enter",
  "sound-on-focus",
  "sound-on-input",
  "sound-on-appear",
  "sound-on-leave",
  "volume",
  "pitch",
  "room",
  "room-mix",
  "sound-mood",
  "sound-mood-mix",
  "sound-delay",
  "sound-sequence",
  "sound-duration",
  "master-volume",
  "master-eq-low",
  "master-eq-high",
  "background-volume",
  "velocity-filter",
  "pan",
  "quality",
]);

const KNOWN_QUALITY = new Set(["low", "medium", "high"]);

const KNOWN_LAYER_KEYS = new Set([
  "noise", "osc", "modal", "tones", "pluck",
  "freq", "pitch-from", "detune",
  "fm-mod", "fm-ratio", "fm-depth",
  "ratios", "decays", "gains",
  "brightness", "decay",
  "filter", "cutoff", "q",
  "attack", "start",
  "gain", "saturation", "drive",
  "pan", "shape",
  // Opt-in: route this layer through the AudioWorklet voice processor
  // for sub-1ms latency. Only applies to single-mode modal/pluck without
  // a per-layer filter; ignored otherwise.
  "realtime",
]);

const KNOWN_VELOCITY_FILTER = new Set(["on", "off", "subtle", "aggressive"]);
const KNOWN_NOISE = new Set(["white", "pink"]);
const KNOWN_OSC = new Set(["sine", "square", "sawtooth", "triangle"]);
const KNOWN_FILTERS = new Set([
  "lowpass", "highpass", "bandpass",
  "lowshelf", "highshelf", "peaking", "notch", "allpass",
  // TPT SVF (Zavalishin) topology — Web Audio IIRFilter under the hood.
  "tpt-lp", "tpt-hp", "tpt-bp", "tpt-notch", "tpt-peak",
]);
const KNOWN_MOODS = new Set([
  "warm", "bright", "glassy", "metallic", "organic",
  "punchy", "retro", "airy", "lofi",
]);
const KNOWN_ROOMS = new Set([
  "none", "small-room", "medium-room", "large-hall", "chamber", "plate",
]);

function fuzzyHint(needle, knownSet) {
  if (!needle) return null;
  const lc = needle.toLowerCase();
  let best = null;
  let bestScore = Infinity;
  for (const known of knownSet) {
    const dist = levenshtein(lc, known);
    if (dist < bestScore && dist <= Math.max(2, Math.floor(known.length / 3))) {
      bestScore = dist;
      best = known;
    }
  }
  return best;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1);
  for (let i = 0; i <= n; i++) prev[i] = i;
  for (let i = 1; i <= m; i++) {
    let cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev[0] = i;
    for (let j = 1; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

export function validateRuleDecls(selector, decls) {
  for (const k of Object.keys(decls)) {
    if (!KNOWN_TOPLEVEL_PROPS.has(k)) {
      const hint = fuzzyHint(k, KNOWN_TOPLEVEL_PROPS);
      warnOnce(`prop:${selector}:${k}`,
        `[acs] unknown property "${k}" in rule "${selector}"` +
          (hint ? ` — did you mean "${hint}"?` : ""));
    }
  }
  if (decls["sound-mood"] && !KNOWN_MOODS.has(decls["sound-mood"])) {
    const hint = fuzzyHint(decls["sound-mood"], KNOWN_MOODS);
    warnOnce(`mood:${selector}:${decls["sound-mood"]}`,
      `[acs] unknown mood "${decls["sound-mood"]}" in "${selector}"` +
        (hint ? ` — did you mean "${hint}"?` : ""));
  }
  if (decls["room"] && !KNOWN_ROOMS.has(decls["room"])) {
    const hint = fuzzyHint(decls["room"], KNOWN_ROOMS);
    warnOnce(`room:${selector}:${decls["room"]}`,
      `[acs] unknown room "${decls["room"]}" in "${selector}"` +
        (hint ? ` — did you mean "${hint}"?` : ""));
  }
  if (decls["quality"] && !KNOWN_QUALITY.has(decls["quality"])) {
    const hint = fuzzyHint(decls["quality"], KNOWN_QUALITY);
    warnOnce(`quality:${selector}:${decls["quality"]}`,
      `[acs] unknown quality "${decls["quality"]}" in "${selector}"` +
        (hint ? ` — did you mean "${hint}"?` : "") +
        " (expected low | medium | high)");
  }
  if (decls["velocity-filter"] && !KNOWN_VELOCITY_FILTER.has(decls["velocity-filter"])) {
    const hint = fuzzyHint(decls["velocity-filter"], KNOWN_VELOCITY_FILTER);
    warnOnce(`vf:${selector}:${decls["velocity-filter"]}`,
      `[acs] unknown velocity-filter "${decls["velocity-filter"]}" in "${selector}"` +
        (hint ? ` — did you mean "${hint}"?` : "") +
        " (expected on | off | subtle | aggressive)");
  }
  // Volume range sanity (per-trigger volume).
  const vol = parseFloat(decls["volume"]);
  if (isFinite(vol) && (vol < 0 || vol > 2)) {
    warnOnce(`vol:${selector}:${vol}`,
      `[acs] volume=${vol} in "${selector}" out of usable range [0..2]; clamped at trigger time`);
  }
  const mvol = parseFloat(decls["master-volume"]);
  if (isFinite(mvol) && (mvol < 0 || mvol > 2)) {
    warnOnce(`mvol:${selector}:${mvol}`,
      `[acs] master-volume=${mvol} in "${selector}" out of typical range [0..2]`);
  }
}

export function validateLayer(soundName, layerName, layer) {
  for (const k of Object.keys(layer)) {
    if (!KNOWN_LAYER_KEYS.has(k)) {
      const hint = fuzzyHint(k, KNOWN_LAYER_KEYS);
      warnOnce(`layerKey:${soundName}.${layerName}:${k}`,
        `[acs] unknown layer key "${k}" in @sound ${soundName}.${layerName}` +
          (hint ? ` — did you mean "${hint}"?` : ""));
    }
  }
  // Source primitive sanity — a layer should declare exactly one of
  // modal / tones / pluck / osc / noise. Without any, playLayer falls
  // through to white noise, which is almost never what the author meant.
  const sources = ["modal", "tones", "pluck", "osc", "noise"]
    .filter((s) => layer[s] !== undefined);
  if (sources.length === 0) {
    warnOnce(`nosrc:${soundName}.${layerName}`,
      `[acs] @sound ${soundName}.${layerName} has no source primitive ` +
      `(modal/tones/pluck/osc/noise) — will play as white noise default`);
  } else if (sources.length > 1) {
    warnOnce(`multisrc:${soundName}.${layerName}`,
      `[acs] @sound ${soundName}.${layerName} declares multiple source ` +
      `primitives [${sources.join(", ")}] — only the first dispatched wins ` +
      `(precedence: modal > tones > pluck > osc > noise)`);
  }
  if (layer.noise && !KNOWN_NOISE.has(layer.noise)) {
    warnOnce(`noise:${soundName}.${layerName}:${layer.noise}`,
      `[acs] unknown noise type "${layer.noise}" — expected white | pink`);
  }
  if (layer.osc && !KNOWN_OSC.has(layer.osc)) {
    const hint = fuzzyHint(layer.osc, KNOWN_OSC);
    warnOnce(`osc:${soundName}.${layerName}:${layer.osc}`,
      `[acs] unknown osc type "${layer.osc}"` +
        (hint ? ` — did you mean "${hint}"?` : ""));
  }
  if (layer.filter && !KNOWN_FILTERS.has(layer.filter)) {
    const hint = fuzzyHint(layer.filter, KNOWN_FILTERS);
    warnOnce(`filter:${soundName}.${layerName}:${layer.filter}`,
      `[acs] unknown filter type "${layer.filter}"` +
        (hint ? ` — did you mean "${hint}"?` : ""));
  }
  // Range sanity (best-effort numeric checks).
  const q = parseFloat(layer.q);
  if (isFinite(q) && q > 4) {
    warnOnce(`q:${soundName}.${layerName}:${q}`,
      `[acs] q=${q} in @sound ${soundName}.${layerName} likely whistles; recommended < 2`);
  }
  const gain = parseFloat(layer.gain);
  if (isFinite(gain) && gain > 2.5) {
    warnOnce(`gain:${soundName}.${layerName}:${gain}`,
      `[acs] gain=${gain} in @sound ${soundName}.${layerName} is very high; ` +
        `auto-calibration scales but consider lower base gain`);
  }
}

export function validateUnknownSound(name, available) {
  if (available.has(name)) return;
  const hint = fuzzyHint(name, available);
  warnOnce(`unknownSound:${name}`,
    `[acs] unknown preset "${name}"` +
      (hint ? ` — did you mean "${hint}"?` : "") +
      ` (use synth(...) or @sound for inline definitions)`);
}
