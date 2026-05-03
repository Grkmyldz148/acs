/* render.mjs — pure-JS offline renderer for ACS presets.
 *
 * No Web Audio dependency. Implements just enough DSP (gain envelope,
 * biquad filter, noise gen, oscillators) to mirror runtime.js preset
 * behavior at sample level, so we can render to WAV for analysis.
 *
 * Usage:  node render.mjs <preset> [--out file.wav] [--seed N]
 */

import { writeFileSync } from "node:fs";

const SR = 48000;
const DURATION = 0.4; // seconds — long enough for any single-shot preset
const N = Math.ceil(SR * DURATION);

// -------------------------------------------------------------------
// Mini DSP toolkit
// -------------------------------------------------------------------

function zeros(n) {
  return new Float32Array(n);
}

function mix(...buffers) {
  const out = zeros(N);
  for (const b of buffers) {
    const len = Math.min(out.length, b.length);
    for (let i = 0; i < len; i++) out[i] += b[i];
  }
  return out;
}

// Linear ramp from `from` at `t0` to `to` at `t1` (seconds), then
// exponential ramp from `to` at `t1` to `final` at `t2`. Standard ADSR
// envelope shape, sample-accurate.
function envelope(buf, t0, t1, t2, peak, final = 0.0001) {
  const i0 = Math.floor(t0 * SR);
  const i1 = Math.floor(t1 * SR);
  const i2 = Math.min(buf.length, Math.floor(t2 * SR));

  // attack: linear 0 → peak
  for (let i = i0; i < i1; i++) {
    const a = (i - i0) / Math.max(1, i1 - i0);
    buf[i] *= a * peak;
  }
  // decay: exponential peak → final
  const lnRatio = Math.log(final / peak);
  for (let i = i1; i < i2; i++) {
    const a = (i - i1) / Math.max(1, i2 - i1);
    const env = peak * Math.exp(lnRatio * a);
    buf[i] *= env;
  }
  // tail: silence
  for (let i = i2; i < buf.length; i++) buf[i] = 0;
}

// White noise burst of `dur` seconds, decaying linearly to 0.
function noiseBurst(dur, decayPow = 1.0, seed = null) {
  const len = Math.min(N, Math.ceil(dur * SR));
  const out = zeros(N);
  let s = seed ?? Math.floor(Math.random() * 1e9);
  // Mulberry32 for reproducibility when seed is given.
  const rng = () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
  for (let i = 0; i < len; i++) {
    out[i] = rng() * Math.pow(1 - i / len, decayPow);
  }
  return out;
}

// Pink noise burst — Paul Kellet's economy filter approximation.
function pinkNoiseBurst(dur, decayPow = 1.0, seed = null) {
  const len = Math.min(N, Math.ceil(dur * SR));
  const out = zeros(N);
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rng = () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = rng();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    out[i] = pink * Math.pow(1 - i / len, decayPow);
  }
  return out;
}

function sine(freq, dur) {
  const len = Math.min(N, Math.ceil(dur * SR));
  const out = zeros(N);
  const w = (2 * Math.PI * freq) / SR;
  for (let i = 0; i < len; i++) out[i] = Math.sin(w * i);
  return out;
}

// Modal resonator filter (Faust modeFilter):
//   b0=1, b1=0, b2=-1
//   r = 0.001^(1/(t60*SR))   — pole magnitude for -60dB in t60 seconds
//   a1 = -2r·cos(ω)
//   a2 = r²
// One pole-pair giving a single ringing partial parameterized by (freq, t60).
function modeFilter(input, freq, t60) {
  const w = (2 * Math.PI * freq) / SR;
  const r = Math.pow(0.001, 1 / (t60 * SR));
  const a1 = -2 * r * Math.cos(w);
  const a2 = r * r;
  const out = zeros(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = x - x2 - a1 * y1 - a2 * y2; // b0=1, b1=0, b2=-1
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

// Asymmetric soft-clip waveshaper (Surge's Polymoog emulation).
// Adds inharmonic distortion that gives modal banks a "warm" character.
function asymWaveshape(buf, drive = 1.0) {
  const out = zeros(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] * drive;
    out[i] = x >= 0 ? Math.tanh(x) : Math.tanh(x * 0.5) * 1.2;
  }
  return out;
}

// Biquad filter — direct form II transposed.
// Coefficients from RBJ Audio EQ Cookbook.
function biquad(buf, type, freq, q) {
  const w0 = (2 * Math.PI * freq) / SR;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);

  let b0, b1, b2, a0, a1, a2;
  if (type === "lowpass") {
    b0 = (1 - cosw) / 2;
    b1 = 1 - cosw;
    b2 = (1 - cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === "highpass") {
    b0 = (1 + cosw) / 2;
    b1 = -(1 + cosw);
    b2 = (1 + cosw) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else if (type === "bandpass") {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  } else {
    throw new Error("unsupported biquad type: " + type);
  }
  // normalize
  b0 /= a0; b1 /= a0; b2 /= a0;
  a1 /= a0; a2 /= a0;

  const out = zeros(buf.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

function gain(buf, g) {
  const out = zeros(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * g;
  return out;
}

// Build a buffer where samples are 1 between t0..t1, 0 elsewhere — used
// as a ramped multiplier alongside envelope().
function shapedEnv(t1Attack, tDecay, peak, final = 0.0001) {
  const out = new Float32Array(N);
  const i1 = Math.floor(t1Attack * SR);
  const i2 = Math.min(N, Math.floor((t1Attack + tDecay) * SR));
  for (let i = 0; i < i1; i++) {
    out[i] = (i / Math.max(1, i1)) * peak;
  }
  const lnRatio = Math.log(final / peak);
  for (let i = i1; i < i2; i++) {
    const a = (i - i1) / Math.max(1, i2 - i1);
    out[i] = peak * Math.exp(lnRatio * a);
  }
  return out;
}

function multiply(a, b) {
  const out = zeros(Math.min(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = a[i] * b[i];
  return out;
}

// -------------------------------------------------------------------
// Preset: keystroke (mirrors runtime.js current implementation)
// -------------------------------------------------------------------

function renderKeystroke({ volume = 0.5, pitchMul = 1, seed = 12345 } = {}) {
  // No randomization (seeded) for reproducible analysis.
  const jitter = 1.0;       // drop random for analysis
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: wooden body
  const bodyDur = 0.08;
  const body = noiseBurst(bodyDur, 1.2, seed);
  const bodyFiltered = biquad(body, "lowpass", 280 * pm, 2.0);
  const bodyEnv = shapedEnv(0.001, 0.06, volJ * 0.85);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  // Layer 2: metal strike
  const strikeDur = 0.03;
  const strike = noiseBurst(strikeDur, 0.8, seed + 1);
  const strikeFiltered = biquad(strike, "bandpass", 1700 * pm, 1.8);
  const strikeEnv = shapedEnv(0.0005, 0.022, volJ * 0.5);
  const strikeOut = multiply(strikeFiltered, strikeEnv);

  // Layer 3: brief metallic tick
  const tick = sine(2200 * pm, 0.025);
  const tickEnv = shapedEnv(0.0005, 0.018, volJ * 0.18);
  const tickOut = multiply(tick, tickEnv);

  return mix(bodyOut, strikeOut, tickOut);
}

// -------------------------------------------------------------------
// WAV writer (16-bit PCM, mono)
// -------------------------------------------------------------------

function writeWav(samples, sampleRate, path) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);                  // PCM chunk size
  buf.writeUInt16LE(1, 20);                   // format = PCM
  buf.writeUInt16LE(1, 22);                   // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);      // byte rate
  buf.writeUInt16LE(2, 32);                   // block align
  buf.writeUInt16LE(16, 34);                  // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  writeFileSync(path, buf);
}

// -------------------------------------------------------------------
// CLI
// -------------------------------------------------------------------

const args = process.argv.slice(2);
const preset = args[0] || "keystroke";
let outPath = `reports/${preset}.wav`;
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--out") outPath = args[++i];
}

function renderKeystrokeV2({ volume = 0.5, pitchMul = 1, seed = 12345 } = {}) {
  // v2 changes vs v1, motivated by analyzer findings:
  //   - dropped 2200Hz tonal sine (caused tonal artifact peak in spectrum)
  //   - extended body decay 60ms -> 100ms, Q 2.0 -> 3.0 (longer wood resonance)
  //   - new "klak" layer at 800Hz Q=2.5 (fills 500-1500Hz mid band)
  //   - kept metal strike but lowered freq 1700 -> 1300, gain 0.5 -> 0.4
  const jitter = 1.0;
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: wooden body — longer decay, higher Q
  const bodyDur = 0.13;
  const body = noiseBurst(bodyDur, 1.2, seed);
  const bodyFiltered = biquad(body, "lowpass", 280 * pm, 3.0);
  const bodyEnv = shapedEnv(0.001, 0.10, volJ * 0.85);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  // Layer 2: klak (NEW) — fills mid band, the actual "tık"
  const klakDur = 0.05;
  const klak = noiseBurst(klakDur, 1.0, seed + 7);
  const klakFiltered = biquad(klak, "bandpass", 800 * pm, 2.5);
  const klakEnv = shapedEnv(0.001, 0.04, volJ * 0.7);
  const klakOut = multiply(klakFiltered, klakEnv);

  // Layer 3: metal strike — lowered freq, slightly quieter
  const strikeDur = 0.03;
  const strike = noiseBurst(strikeDur, 0.8, seed + 1);
  const strikeFiltered = biquad(strike, "bandpass", 1300 * pm, 1.8);
  const strikeEnv = shapedEnv(0.0005, 0.022, volJ * 0.4);
  const strikeOut = multiply(strikeFiltered, strikeEnv);

  // Layer 4 from v1 (2200Hz sine) DROPPED — caused tonal artifact.

  return mix(bodyOut, klakOut, strikeOut);
}

function renderKeystrokeV3({ volume = 0.5, pitchMul = 1, seed = 12345 } = {}) {
  // v3 — redesigned after comparing v2 against a real typewriter recording.
  //   Mistake in v1/v2: modeled body as 280Hz lowpass + narrow bandpass mids,
  //   producing dry "muffled drum" character.
  //   Real typewriter spectrum: broadband from 200Hz to 8kHz (almost flat),
  //   with sub-bass case resonance at ~70Hz and slight HF emphasis 3-5kHz.
  //   Strategy: main layer is broadband noise with mild HF rolloff, plus
  //   quiet sub-bass thump and bright snap accents.
  const jitter = 1.0;
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: Broadband strike — main perceptual character, wide spectrum.
  //   Pink-ish noise, mild lowpass at 8kHz to tame ultra-high, fast decay.
  const strikeDur = 0.06;
  const strike = noiseBurst(strikeDur, 0.5, seed);
  const strikeFiltered = biquad(strike, "lowpass", 8000, 0.7);
  const strikeEnv = shapedEnv(0.0005, 0.018, volJ * 0.65);
  const strikeOut = multiply(strikeFiltered, strikeEnv);

  // Layer 2: Sub-bass thump — case/floor resonance at ~70Hz, sustained.
  const bodyDur = 0.08;
  const body = noiseBurst(bodyDur, 1.0, seed + 1);
  const bodyFiltered = biquad(body, "lowpass", 90, 2.5);
  const bodyEnv = shapedEnv(0.001, 0.05, volJ * 0.45);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  // Layer 3: Bright snap — paper-crack accent at 3kHz+, very short.
  const snapDur = 0.015;
  const snap = noiseBurst(snapDur, 0.6, seed + 2);
  const snapFiltered = biquad(snap, "highpass", 2500, 0.7);
  const snapEnv = shapedEnv(0.0002, 0.008, volJ * 0.4);
  const snapOut = multiply(snapFiltered, snapEnv);

  return mix(strikeOut, bodyOut, snapOut);
}

function renderKeystrokeV4({ volume = 0.6, pitchMul = 1, seed = 12345 } = {}) {
  // v4 — closer match to real typewriter spectrum:
  //   - main strike uses pink noise (matches real's -3dB/oct slope)
  //   - body louder + slightly longer (sub-bass anchor at ~80Hz)
  //   - mid emphasis layer at 2kHz adds the bright "metal-on-paper" peak
  //     visible in the real recording around 2-5kHz
  //   - overall louder to match real RMS
  const jitter = 1.0;
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: Broadband strike — PINK noise (1/f) for natural spectral tilt.
  const strikeDur = 0.05;
  const strike = pinkNoiseBurst(strikeDur, 0.4, seed);
  const strikeFiltered = biquad(strike, "lowpass", 9000, 0.7);
  const strikeEnv = shapedEnv(0.0005, 0.020, volJ * 1.0);
  const strikeOut = multiply(strikeFiltered, strikeEnv);

  // Layer 2: Sub-bass body — case resonance at ~80Hz, sustained.
  const bodyDur = 0.10;
  const body = noiseBurst(bodyDur, 1.0, seed + 1);
  const bodyFiltered = biquad(body, "lowpass", 100, 2.5);
  const bodyEnv = shapedEnv(0.001, 0.07, volJ * 0.8);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  // Layer 3: Bright peak emphasis — adds 2-5kHz "metal" character
  //   matching the broad bump visible in the real spectrum.
  const peakDur = 0.025;
  const peak = pinkNoiseBurst(peakDur, 0.5, seed + 2);
  const peakFiltered = biquad(peak, "bandpass", 2200, 1.5);
  const peakEnv = shapedEnv(0.0005, 0.012, volJ * 0.55);
  const peakOut = multiply(peakFiltered, peakEnv);

  return mix(strikeOut, bodyOut, peakOut);
}

function renderKeystrokeV5({ volume = 0.7, pitchMul = 1, seed = 12345 } = {}) {
  // v5 — boost high-band energy + overall level to match real typewriter:
  //   - main strike NO lowpass, full bandwidth (real has content to 10kHz+)
  //   - separate high accent (3-5kHz) for the metal-on-paper bite
  //   - body unchanged from v4
  //   - overall amplitude up ~6dB to match real RMS
  const jitter = 1.0;
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: Broadband strike — full-spectrum pink noise, no top filter.
  const strikeDur = 0.05;
  const strike = pinkNoiseBurst(strikeDur, 0.4, seed);
  const strikeEnv = shapedEnv(0.0005, 0.020, volJ * 1.2);
  const strikeOut = multiply(strike, strikeEnv);

  // Layer 2: Sub-bass body — case resonance at ~80Hz.
  const bodyDur = 0.10;
  const body = noiseBurst(bodyDur, 1.0, seed + 1);
  const bodyFiltered = biquad(body, "lowpass", 100, 2.5);
  const bodyEnv = shapedEnv(0.001, 0.07, volJ * 0.9);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  // Layer 3: High-band accent — broad bandpass 3-5kHz, the bright bite.
  const hiDur = 0.025;
  const hi = noiseBurst(hiDur, 0.5, seed + 2);
  const hiFiltered = biquad(hi, "bandpass", 3500, 1.0);
  const hiEnv = shapedEnv(0.0003, 0.012, volJ * 0.7);
  const hiOut = multiply(hiFiltered, hiEnv);

  // Layer 4: Mid peak — 1-2kHz emphasis matching real spectrum bump.
  const midDur = 0.03;
  const mid = pinkNoiseBurst(midDur, 0.5, seed + 3);
  const midFiltered = biquad(mid, "bandpass", 1500, 1.2);
  const midEnv = shapedEnv(0.0005, 0.015, volJ * 0.6);
  const midOut = multiply(midFiltered, midEnv);

  return mix(strikeOut, bodyOut, hiOut, midOut);
}

function renderKeystrokeV6({ volume = 0.7, pitchMul = 1, seed = 12345 } = {}) {
  // v6 — minimalist: drop emphasis layers from v5 (they pushed centroid
  // too high), boost body for the low-end peak, lowpass strike at 7kHz
  // to roll off above where real recording's content dies.
  const jitter = 1.0;
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: Broadband pink strike, gently lowpassed at 7kHz.
  const strikeDur = 0.05;
  const strike = pinkNoiseBurst(strikeDur, 0.4, seed);
  const strikeFiltered = biquad(strike, "lowpass", 7000, 0.7);
  const strikeEnv = shapedEnv(0.0005, 0.020, volJ * 1.0);
  const strikeOut = multiply(strikeFiltered, strikeEnv);

  // Layer 2: Sub-bass body — LOUD now, this is the dominant low-freq peak.
  const bodyDur = 0.12;
  const body = noiseBurst(bodyDur, 1.0, seed + 1);
  const bodyFiltered = biquad(body, "lowpass", 100, 3.0);
  const bodyEnv = shapedEnv(0.001, 0.09, volJ * 1.4);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  return mix(strikeOut, bodyOut);
}

function renderKeystrokeV7({ volume = 0.7, pitchMul = 1, seed = 12345 } = {}) {
  // v7 — add a wide-Q mid-high plateau layer to fill 1-5kHz (real has
  // a broad bump there that v6 was missing). Keep v6's strong body.
  const jitter = 1.0;
  const volJ = volume;
  const pm = pitchMul * jitter;

  // Layer 1: Broadband pink strike, gently lowpassed at 8kHz.
  const strikeDur = 0.05;
  const strike = pinkNoiseBurst(strikeDur, 0.4, seed);
  const strikeFiltered = biquad(strike, "lowpass", 8000, 0.7);
  const strikeEnv = shapedEnv(0.0005, 0.020, volJ * 0.9);
  const strikeOut = multiply(strikeFiltered, strikeEnv);

  // Layer 2: Sub-bass body — strong, the dominant low peak.
  const bodyDur = 0.12;
  const body = noiseBurst(bodyDur, 1.0, seed + 1);
  const bodyFiltered = biquad(body, "lowpass", 100, 3.0);
  const bodyEnv = shapedEnv(0.001, 0.09, volJ * 1.4);
  const bodyOut = multiply(bodyFiltered, bodyEnv);

  // Layer 3: Mid-high plateau (NEW) — wide bandpass 2.5kHz, low Q for
  // broad coverage of the 1-5kHz region present in the real recording.
  const plateauDur = 0.03;
  const plateau = pinkNoiseBurst(plateauDur, 0.5, seed + 2);
  const plateauFiltered = biquad(plateau, "bandpass", 2500, 0.7);
  const plateauEnv = shapedEnv(0.0005, 0.018, volJ * 0.85);
  const plateauOut = multiply(plateauFiltered, plateauEnv);

  return mix(strikeOut, bodyOut, plateauOut);
}

// -------------------------------------------------------------------
// Bell — v1 (current runtime.js implementation, 3 sines summed)
// -------------------------------------------------------------------
function renderBellV1({ volume = 0.5, pitchMul = 1, seed = 12345 } = {}) {
  const partials = [
    { f: 880,  g: 1.00, d: 1.20 },
    { f: 1320, g: 0.40, d: 0.40 },
    { f: 2640, g: 0.15, d: 0.18 },
  ];
  const out = zeros(N);
  for (const p of partials) {
    const len = Math.min(N, Math.ceil(p.d * SR + 0.05 * SR));
    const w = (2 * Math.PI * p.f * pitchMul) / SR;
    const lnRatio = Math.log(0.0001 / p.g);
    for (let i = 0; i < len; i++) {
      const att = Math.min(1, i / (0.002 * SR));
      const decayPos = Math.max(0, i / (p.d * SR));
      const env = att * p.g * Math.exp(lnRatio * decayPos);
      out[i] += Math.sin(w * i) * env * volume;
    }
  }
  return out;
}

// -------------------------------------------------------------------
// Bell — v2 (modal synthesis: noise burst → asym waveshape → 4 modeFilters)
//
// Inspired by Surge XT's ResonatorEffect topology (asym pre-shaper + parallel
// resonant bands) + Faust's modeFilter math (t60-parameterized partials)
// + Tone.js MetalSynth TR-808 inharmonic ratios.
// -------------------------------------------------------------------
function renderBellV2({
  volume = 0.5,
  pitchMul = 1,
  fundamental = 880,
  ratios = [1.0, 1.483, 1.932, 2.546],
  // Higher partials decay faster — physically correct for struck bells.
  decays = [0.9, 0.45, 0.25, 0.12],
  gains = [1.0, 0.55, 0.3, 0.18],
  shape = 1.2,
  seed = 12345,
} = {}) {
  const burstDur = 0.003;
  const burst = noiseBurst(burstDur, 0.5, seed);
  const exc = asymWaveshape(burst, shape);

  // Sum modal partials.
  const out = zeros(N);
  for (let i = 0; i < ratios.length; i++) {
    const f = fundamental * pitchMul * ratios[i];
    const partial = modeFilter(exc, f, decays[i]);
    for (let j = 0; j < N; j++) out[j] += partial[j] * gains[i];
  }

  // Auto-normalize to leave headroom (modal banks have unpredictable gain).
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
  const target = volume * 0.5; // peak target ~-6dB
  const scale = peak > 0 ? target / peak : 0;
  for (let i = 0; i < N; i++) out[i] *= scale;
  return out;
}

const renderers = {
  keystroke: renderKeystroke,
  bell: renderBellV1,
  "bell-v2": renderBellV2,
  "keystroke-v2": renderKeystrokeV2,
  "keystroke-v3": renderKeystrokeV3,
  "keystroke-v4": renderKeystrokeV4,
  "keystroke-v5": renderKeystrokeV5,
  "keystroke-v6": renderKeystrokeV6,
  "keystroke-v7": renderKeystrokeV7,
};
if (!renderers[preset]) {
  console.error("Unknown preset:", preset);
  console.error("Available:", Object.keys(renderers).join(", "));
  process.exit(1);
}

const samples = renderers[preset]();
writeWav(samples, SR, outPath);
console.log(`Rendered ${preset} → ${outPath} (${(samples.length / SR).toFixed(3)}s, ${SR}Hz)`);
