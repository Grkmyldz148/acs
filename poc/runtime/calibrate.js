/* calibrate.js — auto-loudness leveling across presets.
 *
 * Goal: every preset, regardless of frequency content, attack shape, or
 * sustain length, plays at the same perceived loudness for a given user
 * volume. So `tap-tactile` and `gong` and `thunk` all sound equally
 * "present" at volume=0.5.
 *
 * Pipeline (per preset, run offline at bind time):
 *   1. Render preset with reference parameters (volume=0.5, pitchMul=1)
 *      to a plain OfflineAudioContext destination.
 *   2. Measure UN-weighted peak (what the runtime limiter sees).
 *   3. Apply K-weighting in JS (high-shelf +4 dB @ 1500 Hz → high-pass
 *      @ 60 Hz, ITU-R BS.1770-inspired) and measure RMS over the
 *      active region (samples ≥ 2% of K-weighted peak).
 *   4. Compute factor = TARGET_RMS / kWeightedRms. NO floor clamp —
 *      naturally-loud presets need real attenuation.
 *   5. Cap by un-weighted peak: ensure peak * factor ≤ TARGET_PEAK so
 *      the master limiter barely engages and equal-loudness survives
 *      to the speakers.
 *
 * Why peak-cap matters: the runtime master limiter pulls peaks above
 * its threshold down nonlinearly. If calibration sends a transient at
 * peak=1.5 and a sustain at peak=0.5, the limiter crushes the
 * transient harder, breaking the equal-loudness we just measured.
 * By keeping every preset's calibrated peak ≤ TARGET_PEAK (0.85), the
 * limiter stays in its linear region and our measurement holds.
 *
 * Pre-computed factors for built-in presets are baked in (see
 * BAKED_FACTORS) so the user's first click is never unleveled. The
 * background calibrator still runs to (a) verify drift and (b) handle
 * user-defined @sound blocks that aren't in the bake.
 */

// Aggressive targets — modern UI sounds compete with system audio, music,
// and other browser tabs. We push past 0 dBFS into the limiter's
// compression region; the limiter's job is to soft-clip overshoots while
// keeping the higher average level. Without this, naturally peaky sounds
// (bells, gongs) stay 6+ dB quieter than transients.
const TARGET_RMS = 0.30; // ≈ -10 dB K-weighted, broadcast-loud
const TARGET_PEAK = 1.8; // overdrives limiter ~5 dB → soft-compressed bells survive louder

// Per-class loudness budget (multiplier applied to TARGET_RMS during
// measurement). Clicks should be quieter than bells (less obtrusive for
// UI feedback); transitions are mid; bells/notifications get a slight
// boost since the user actively wants to notice them.
// Tightened 2026-05-03 to compress the spread toward 6 dB. Within-class
// outliers are also handled by PRESET_TARGET_MULT below.
const CLASS_TARGET_MULT = {
  click: 0.80,
  toggle: 0.90,
  transition: 0.95,
  texture: 0.95,
  string: 0.95,
  feedback: 0.95,
  percussion: 1.00,
  bell: 1.05,
  notification: 1.10,
  default: 1.00,
};

// Per-preset overrides for the post-cal RMS outliers that class-level
// budgets can't catch. Multiplier applies to TARGET_RMS *and* relaxes
// the peak cap proportionally — sweepy / sustained presets (page-enter,
// gong, error) hit the peak limit before reaching peer loudness; for
// these we accept slightly more limiter work to bring them up to the
// rest. Negative outliers (top of post-cal range) get a downward trim.
const PRESET_TARGET_MULT = {
  // Boost — peak-bound sweepy single-osc / single-mode presets.
  "page-enter": 1.20,
  "page-exit": 1.10,
  gong: 1.20,
  error: 1.15,
  buzz: 1.10,
  // Trim — within-class loud outliers.
  tick: 0.80,
  confirm: 0.85,
  prompt: 0.85,
  ting: 0.85,
  "dropdown-open": 0.85,
  "dropdown-close": 0.85,
  "toggle-on": 0.90,
  "toggle-off": 0.90,
};
const FACTOR_MAX = 20.0; // bass-heavy DSL presets legitimately need 10x+
const ACTIVE_THRESHOLD_RATIO = 0.02;
const RENDER_DURATION = 1.5;

function classifyPreset(name) {
  if (/^(click|tap|tick|pop|keystroke)/.test(name)) return "click";
  if (/^(modal|drawer|dropdown|page)-/.test(name)) return "transition";
  if (/^toggle-/.test(name)) return "toggle";
  if (/^(kick|snare|hat|clap|thunk|knock|woodblock)$/.test(name))
    return "percussion";
  if (/^(success|complete|confirm|error|denied|prompt|buzz)$/.test(name))
    return "feedback";
  if (/^(notify|ding|mention|badge)$/.test(name)) return "notification";
  if (/^(bell|chime|glass|ting|gong|carriage-return|old-bell)/.test(name))
    return "bell";
  if (/^(pluck|string)/.test(name)) return "string";
  if (/^(whoosh|swoosh|sparkle|ping)$/.test(name)) return "texture";
  return "default";
}

// Loudness-summation compensation: short transients (<100ms active)
// need extra peak to be perceived equal-loud (auditory integration ~200ms).
// The multiplier is applied to TARGET_RMS so the calibration aims higher
// for short sounds, yielding more peak post-factor.
function durationCompensation(activeDurationSec) {
  if (activeDurationSec >= 0.2) return 1.0;
  if (activeDurationSec <= 0.005) return 1.5;
  // Smooth ramp from 1.0 (200ms) to 1.5 (5ms).
  const t = (0.2 - activeDurationSec) / 0.195;
  return 1.0 + 0.5 * t;
}

// Build-time baked factors for the default preset library — measured by
// `node analyzer/defaults-loudness.mjs --bake` against poc/defaults.acs
// using the same K-weighted RMS + peak-cap formula as runtime calibrate().
// Loaded synchronously at module-load so the FIRST user click is already
// leveled — no "first loud, then quiet" jarring as background calibration
// catches up. Procedural presets are hand-tuned (analyzer can't render
// Web Audio nodes); runtime calibration refines all values into the
// localStorage cache.
const BAKED_FACTORS = {
  // DSL presets (defaults.acs) — re-baked 2026-05-03 with corrected
  // analyzer: added renderTonesLayer (was rendering tones as noise),
  // softened modal saturation tanh(*8) → tanh(*2) to match runtime,
  // applied `start:` offset for sequenced multi-layer presets.
  // Re-bake with: node analyzer/defaults-loudness.mjs --bake
  // Re-baked 2026-05-03 (Phase 8.9): added PRESET_TARGET_MULT to compress
  // post-cal spread from 7.2 dB → 4.8 dB.
  badge: 6.695,
  bell: 4.602,
  "bell-bright": 4.343,
  "bell-soft": 6.960,
  buzz: 13.219,
  "carriage-return": 13.643,
  chime: 4.819,
  "chime-soft": 6.777,
  clap: 16.072,
  click: 4.673,
  "click-soft": 13.343,
  complete: 9.243,
  confirm: 9.828,
  denied: 6.016,
  ding: 5.032,
  "drawer-close": 11.350,
  "drawer-open": 13.316,
  "dropdown-close": 9.332,
  "dropdown-open": 10.036,
  error: 6.895,
  glass: 5.495,
  gong: 5.248,
  hat: 9.099,
  kick: 12.928,
  mention: 6.281,
  "modal-close": 16.035,
  "modal-open": 18.010,
  notify: 4.285,
  "page-enter": 15.521,
  "page-exit": 7.559,
  ping: 5.326,
  "pluck-bright": 7.994,
  "pluck-soft": 10.729,
  pop: 9.866,
  prompt: 12.121,
  snare: 3.832,
  sparkle: 11.406,
  string: 5.499,
  success: 7.153,
  swoosh: 16.347,
  tap: 8.677,
  "tap-tactile": 6.248,
  thunk: 11.779,
  tick: 7.779,
  ting: 4.683,
  "toggle-off": 11.154,
  "toggle-on": 10.510,
  whoosh: 11.828,
  woodblock: 3.673,
  // Procedural-only presets (runtime/presets.js) — analyzer can't render
  // Web Audio nodes, hand-tuned. Runtime calibration refines into the
  // localStorage cache.
  keystroke: 0.4,
  "old-bell": 0.7,
};

// BAKED_FACTORS are AUTHORITATIVE for built-in presets. We don't let the
// runtime calibration override them because Web Audio's IIRFilter and
// our analyzer's modeFilter can produce slightly different peak/RMS,
// and the analyzer's values were chosen / hand-tuned for the right
// audible result. localStorage cache only stores measurements for
// USER-DEFINED @sound presets (not baked).
// Project rebrand 2026-05-03: prefix migrated `acss.` → `acs.`. The
// stale-version sweep matches BOTH old and new prefixes so users who had
// cached v1-v15 under the old name don't keep stale entries forever.
const CACHE_KEY = "acs.calibration.v16";
function loadCachedFactors() {
  const map = new Map(Object.entries(BAKED_FACTORS));
  try {
    if (typeof localStorage === "undefined") return map;
    // Sweep stale cache versions. Collect first, remove second — removing
    // while iterating shifts indices and skips entries.
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const isOld = k.startsWith("acs.calibration.");
      const isNew = k.startsWith("acs.calibration.");
      if ((isOld || isNew) && k !== CACHE_KEY) {
        stale.push(k);
      }
    }
    for (const k of stale) localStorage.removeItem(k);
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        // Only apply cached values for non-baked names (user @sound).
        for (const [k, v] of Object.entries(obj)) {
          if (!(k in BAKED_FACTORS)) map.set(k, v);
        }
      }
    }
  } catch (e) {}
  return map;
}
let saveTimer = null;
function saveCachedFactors() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      // Only persist user-@sound factors. BAKED_FACTORS are authoritative
      // and re-loaded from JS on next page load — caching them just bloats
      // localStorage and creates a divergence risk when BAKED is updated.
      const obj = {};
      for (const [k, v] of factors) {
        if (!(k in BAKED_FACTORS)) obj[k] = v;
      }
      if (typeof localStorage !== "undefined") {
        if (Object.keys(obj).length === 0) {
          localStorage.removeItem(CACHE_KEY);
        } else {
          localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
        }
      }
    } catch (e) {}
  }, 500);
}

const factors = loadCachedFactors();
const inflight = new Map();
let enabled = true;

export function setEnabled(v) {
  enabled = !!v;
}
export function isEnabled() {
  return enabled;
}

export function getCalibrationFactor(name) {
  if (!enabled) return 1.0;
  return factors.get(name) ?? 1.0;
}

// JS biquad filter — used to apply K-weighting to a rendered buffer
// in pure JS so we only need ONE OfflineAudioContext render.
function biquadFilter(input, type, freq, q, gainDb, sampleRate) {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "highpass") {
    b0 = (1 + cosw) / 2;
    b1 = -(1 + cosw);
    b2 = (1 + cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === "highshelf") {
    const A = Math.pow(10, gainDb / 40);
    const beta = Math.sqrt(A) / q;
    b0 =     A * ((A + 1) + (A - 1) * cosw + beta * sinw);
    b1 = -2 * A * ((A - 1) + (A + 1) * cosw);
    b2 =     A * ((A + 1) + (A - 1) * cosw - beta * sinw);
    a0 =          (A + 1) - (A - 1) * cosw + beta * sinw;
    a1 =      2 * ((A - 1) - (A + 1) * cosw);
    a2 =          (A + 1) - (A - 1) * cosw - beta * sinw;
  } else throw new Error("biquadFilter: unsupported type " + type);
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

// Audible-band weighting: high-pass at 200 Hz (kills sub-bass that small
// speakers can't reproduce — laptop / phone / earbud rolloff is around
// 150-250 Hz) plus a +4 dB shelf at 1500 Hz to weight the mid-treble
// where the ear is most sensitive.
//
// Critical: peak measurement uses this same filtered signal. Sub-bass
// content in bass-heavy presets (kick body @ 55Hz, gong body @ 110Hz)
// inflates the un-filtered peak by 10-50x, dragging the calibration
// factor down so far that the AUDIBLE layers (mid-range click, shimmer,
// crack) become inaudible. Filtering out the inaudible bass before
// peak/RMS measurement aligns the calibration with what the user hears.
function kWeight(buf, sampleRate) {
  let out = biquadFilter(buf, "highpass", 200, 0.7, 0, sampleRate);
  out = biquadFilter(out, "highshelf", 1500, 1.0, 4, sampleRate);
  return out;
}

// Schedule a one-shot offline render; cache the resulting factor.
export function calibrate(name, runFn, sampleRate = 48000) {
  if (!enabled) return Promise.resolve(1.0);
  if (factors.has(name)) return Promise.resolve(factors.get(name));
  if (inflight.has(name)) return inflight.get(name);

  const promise = (async () => {
    try {
      const offline = new OfflineAudioContext(
        1,
        Math.ceil(sampleRate * RENDER_DURATION),
        sampleRate
      );
      runFn(offline, {
        dest: offline.destination,
        volume: 0.5,
        pitchMul: 1,
      });
      const buf = await offline.startRendering();
      const ch = buf.getChannelData(0);

      // Filter-pass first — peak/RMS measured in the audible band
      // (200 Hz - 8 kHz weighted). Sub-bass that small speakers can't
      // reproduce doesn't count toward calibration; this prevents the
      // audible mid-range from being sacrificed to unheard bass peaks.
      const weighted = kWeight(ch, sampleRate);
      let kPeak = 0;
      for (let i = 0; i < weighted.length; i++) {
        const a = Math.abs(weighted[i]);
        if (a > kPeak) kPeak = a;
      }
      if (kPeak < 0.0005) {
        // Silent in the audible band (often async preset that didn't
        // render in offline ctx, or a sub-bass-only preset).
        factors.set(name, 1.0);
        return 1.0;
      }
      // Loudness window: RMS over the loudest 150 ms starting from first
      // audible sample. Matches auditory integration time so a bell's
      // long quiet tail doesn't get averaged in (which would drag the
      // RMS down and over-attenuate the bell's audible strike).
      const WINDOW_SEC = 0.15;
      const windowSamples = Math.floor(WINDOW_SEC * sampleRate);
      const threshold = kPeak * ACTIVE_THRESHOLD_RATIO;
      let firstAudible = -1;
      for (let i = 0; i < weighted.length; i++) {
        if (Math.abs(weighted[i]) >= threshold) { firstAudible = i; break; }
      }
      let kRms = kPeak;
      let activeDuration = 0;
      if (firstAudible >= 0) {
        const winEnd = Math.min(weighted.length, firstAudible + windowSamples);
        let sumSq = 0;
        let count = 0;
        for (let i = firstAudible; i < winEnd; i++) {
          sumSq += weighted[i] * weighted[i];
          count++;
        }
        kRms = count > 0 ? Math.sqrt(sumSq / count) : kPeak;
        // Active duration for short-transient compensation: if the sound
        // dies before the window ends, count only the audible portion.
        let lastAudible = firstAudible;
        for (let i = winEnd - 1; i >= firstAudible; i--) {
          if (Math.abs(weighted[i]) >= threshold) { lastAudible = i; break; }
        }
        activeDuration = (lastAudible - firstAudible) / sampleRate;
      }
      const cls = classifyPreset(name);
      const classTargetMult = CLASS_TARGET_MULT[cls] ?? CLASS_TARGET_MULT.default;
      const presetMult = PRESET_TARGET_MULT[name] ?? 1.0;
      const target = TARGET_RMS * durationCompensation(activeDuration) * classTargetMult * presetMult;

      let factor = kRms > 0.0005 ? target / kRms : 1.0;
      // Peak-cap on the weighted (audible-band) peak. Per-preset boost
      // (presetMult > 1) relaxes the cap proportionally — sweepy long
      // presets like page-enter need to push past TARGET_PEAK to reach
      // peer loudness. The runtime limiter handles the overshoot.
      const peakLimited = (TARGET_PEAK * presetMult) / kPeak;
      factor = Math.min(factor, peakLimited);
      factor = Math.min(FACTOR_MAX, factor);
      factor = Math.max(0.01, factor);

      // Class budget already applied to TARGET_RMS above (CLASS_TARGET_MULT).
      factors.set(name, factor);
      saveCachedFactors();
      return factor;
    } catch (e) {
      console.warn(`[acs] calibration failed for "${name}":`, e);
      factors.set(name, 1.0);
      return 1.0;
    } finally {
      inflight.delete(name);
    }
  })();

  inflight.set(name, promise);
  return promise;
}

export function _factors() {
  return Object.fromEntries(factors);
}
export function _setFactor(name, value) {
  factors.set(name, value);
}

// Whether a name has a build-time baked factor. Used by index.js to
// decide if a parsed @sound is shadowing a built-in (in which case the
// baked factor doesn't apply to the user's DSP and must be invalidated).
export function isBaked(name) {
  return name in BAKED_FACTORS;
}

// Invalidate a cached factor so the next calibrate() call re-measures.
// Used when a user @sound block overrides a built-in name — the baked
// factor was for the original preset, not the user's redefinition.
export function invalidateFactor(name) {
  factors.delete(name);
  inflight.delete(name);
}
