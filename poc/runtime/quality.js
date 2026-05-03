/* quality.js — global low/medium/high CPU/quality knob.
 *
 * Set on `:root` via `quality: low | medium | high` (default = medium).
 * Affects:
 *   - voicepool default cap (low=4, medium=8, high=16)
 *   - modal partial cap in playModalLayer / playTonesLayer
 *   - reverb IR length scale (low shortens, high keeps)
 *
 * Doesn't change preset sound character at medium — it only widens or
 * tightens budgets. low loses high partials (perceptual brightness)
 * and concurrency headroom; high mostly buys polyphony for spam-rich UIs.
 */

const LEVELS = {
  low:    { voiceCap: 4,  modalPartials: 3, reverbScale: 0.6 },
  medium: { voiceCap: 8,  modalPartials: 16, reverbScale: 1.0 },
  high:   { voiceCap: 16, modalPartials: 16, reverbScale: 1.0 },
};

let current = "medium";

export function setQuality(level) {
  if (typeof level !== "string") return;
  const lc = level.trim().toLowerCase();
  if (LEVELS[lc]) current = lc;
}

export function getQuality() {
  return current;
}

export function getQualityProfile() {
  return LEVELS[current];
}
