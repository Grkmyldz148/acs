#!/usr/bin/env node
/* lint-acs.mjs — CLI validator for .acs files.
 *
 * Usage:  node tools/lint-acs.mjs path/to/file.acs [more-files...]
 *
 * Prints warnings for unknown property names, unknown layer keys,
 * mood/room values, oscillator/filter/noise types. Exit code is the
 * number of warnings (0 = clean).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// We can import directly from the runtime modules — they're pure ESM.
const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

const { parse, parseLayer } = await import(`${RUNTIME}/parse.js`);

// Inline copies of the validate sets (avoid pulling in browser-only validate.js).
const KNOWN_TOPLEVEL = new Set([
  "sound", "sound-on-click", "sound-on-enter", "sound-on-focus",
  "sound-on-input", "sound-on-appear", "sound-on-leave", "sound-on-submit",
  "volume", "pitch", "room", "room-mix",
  "sound-mood", "sound-mood-mix", "sound-delay", "sound-sequence", "sound-duration",
  "master-volume", "master-eq-low", "master-eq-high",
  "background-volume", "velocity-filter", "pan", "quality",
]);
const KNOWN_LAYER = new Set([
  "noise", "osc", "modal", "tones", "pluck", "freq", "pitch-from",
  "fm-mod", "fm-ratio", "fm-depth", "ratios", "decays", "gains",
  "brightness", "decay", "filter", "cutoff", "q", "attack",
  "gain", "saturation", "drive", "pan", "shape", "start", "detune",
  "realtime",
]);
const KNOWN_NOISE = new Set(["white", "pink"]);
const KNOWN_OSC = new Set(["sine", "square", "sawtooth", "triangle"]);
const KNOWN_FILTERS = new Set([
  "lowpass", "highpass", "bandpass",
  "lowshelf", "highshelf", "peaking", "notch", "allpass",
]);
const KNOWN_MOODS = new Set([
  "warm", "bright", "glassy", "metallic", "organic",
  "punchy", "retro", "airy", "lofi",
]);
const KNOWN_ROOMS = new Set([
  "none", "small-room", "medium-room", "large-hall", "chamber",
]);

function lev(a, b) {
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
function hint(needle, set) {
  let best = null, score = Infinity;
  for (const k of set) {
    const d = lev(needle.toLowerCase(), k);
    if (d < score && d <= Math.max(2, Math.floor(k.length / 3))) {
      score = d; best = k;
    }
  }
  return best;
}

function lintFile(path) {
  const warnings = [];
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    warnings.push(`Cannot read ${path}: ${e.message}`);
    return warnings;
  }
  const rules = parse(text);

  for (const r of rules) {
    if (r.selector.startsWith("@sound ")) {
      const sname = r.selector.slice(7).trim();
      for (const [layerName, valOrObj] of Object.entries(r.decls)) {
        // Nested @sound: value is already an object. Inline (legacy):
        // value is a string that needs parseLayer.
        const layer = typeof valOrObj === "string" ? parseLayer(valOrObj) : valOrObj;
        for (const k of Object.keys(layer)) {
          if (!KNOWN_LAYER.has(k)) {
            const h = hint(k, KNOWN_LAYER);
            warnings.push(
              `${path}: @sound ${sname}.${layerName}: unknown layer key "${k}"` +
                (h ? ` — did you mean "${h}"?` : "")
            );
          }
        }
        if (layer.noise && !KNOWN_NOISE.has(layer.noise)) {
          warnings.push(`${path}: @sound ${sname}.${layerName}: unknown noise "${layer.noise}"`);
        }
        if (layer.osc && !KNOWN_OSC.has(layer.osc)) {
          const h = hint(layer.osc, KNOWN_OSC);
          warnings.push(`${path}: @sound ${sname}.${layerName}: unknown osc "${layer.osc}"` +
            (h ? ` — did you mean "${h}"?` : ""));
        }
        if (layer.filter && !KNOWN_FILTERS.has(layer.filter)) {
          const h = hint(layer.filter, KNOWN_FILTERS);
          warnings.push(`${path}: @sound ${sname}.${layerName}: unknown filter "${layer.filter}"` +
            (h ? ` — did you mean "${h}"?` : ""));
        }
        const q = parseFloat(layer.q);
        if (isFinite(q) && q > 4) {
          warnings.push(`${path}: @sound ${sname}.${layerName}: q=${q} likely whistles (recommended < 2)`);
        }
        const gain = parseFloat(layer.gain);
        if (isFinite(gain) && gain > 2.5) {
          warnings.push(`${path}: @sound ${sname}.${layerName}: gain=${gain} very high`);
        }
      }
    } else {
      for (const k of Object.keys(r.decls)) {
        if (!KNOWN_TOPLEVEL.has(k)) {
          const h = hint(k, KNOWN_TOPLEVEL);
          warnings.push(
            `${path}: ${r.selector}: unknown property "${k}"` +
              (h ? ` — did you mean "${h}"?` : "")
          );
        }
      }
      if (r.decls["sound-mood"] && !KNOWN_MOODS.has(r.decls["sound-mood"])) {
        const h = hint(r.decls["sound-mood"], KNOWN_MOODS);
        warnings.push(`${path}: ${r.selector}: unknown mood "${r.decls["sound-mood"]}"` +
          (h ? ` — did you mean "${h}"?` : ""));
      }
      if (r.decls["room"] && !KNOWN_ROOMS.has(r.decls["room"])) {
        const h = hint(r.decls["room"], KNOWN_ROOMS);
        warnings.push(`${path}: ${r.selector}: unknown room "${r.decls["room"]}"` +
          (h ? ` — did you mean "${h}"?` : ""));
      }
    }
  }
  return warnings;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node tools/lint-acs.mjs <file.acs> [more.acs ...]");
  process.exit(1);
}

let total = 0;
for (const f of files) {
  const warnings = lintFile(f);
  for (const w of warnings) console.log(w);
  total += warnings.length;
}
if (total === 0) console.log(`✓ No warnings.`);
else console.log(`\n${total} warning${total === 1 ? "" : "s"}.`);
process.exit(total ? 1 : 0);
