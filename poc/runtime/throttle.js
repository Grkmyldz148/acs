/* throttle.js — per-preset rate limiting.
 *
 * Prevents two failure modes:
 *   1. Accidental double-fires (mouse double-click producing duplicate
 *      events within ~30ms — sound stacks, peaks, sounds wrong).
 *   2. Sustained spam (rapid scroll-snap, key-mash) generating dozens
 *      of overlapping voices that overpower the master limiter.
 *
 * `keystroke` and other typing/slider sounds get a higher cap because
 * fast typists exceed 8 chars/300ms (27 chars/sec — average is 4-6
 * cps, fast 10+ cps — but burst typing hits cap and drops feedback).
 */

const MIN_INTERVAL_MS = 25;
const SPAM_WINDOW_MS = 300;
const SPAM_CAP_DEFAULT = 8;
// Continuous-input presets: typing, slider drags. Allow up to ~50/sec.
const SPAM_CAP_BY_PRESET = {
  keystroke: 16,
  tick: 16,
};

const recentTriggers = new Map(); // presetName -> [timestamps...]

export function shouldThrottle(name, nowMs) {
  let arr = recentTriggers.get(name);
  if (!arr) {
    arr = [];
    recentTriggers.set(name, arr);
  }
  // Drop entries older than SPAM_WINDOW_MS.
  while (arr.length && nowMs - arr[0] > SPAM_WINDOW_MS) arr.shift();
  const cap = SPAM_CAP_BY_PRESET[name] ?? SPAM_CAP_DEFAULT;
  // Hard cap: too many in window.
  if (arr.length >= cap) return true;
  // Min-interval: too soon after last.
  if (arr.length > 0 && nowMs - arr[arr.length - 1] < MIN_INTERVAL_MS)
    return true;
  arr.push(nowMs);
  return false;
}
