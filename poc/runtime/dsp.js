/* dsp.js — layer playback, synth(...), modal, Karplus-Strong.
 *
 * Each layer of an @sound block, and each synth(...) call, becomes a
 * voice graph built here. Source dispatch:
 *
 *   layer.modal  → playModalLayer  (parallel modeFilters)
 *   layer.pluck  → playPluckLayer  (Karplus-Strong)
 *   layer.osc    → tonal oscillator + envelope
 *   else (noise) → filtered noise burst
 *
 * Common tail: optional saturation (drive), optional pan, gain envelope.
 */

import { parseFreq, parseTime, parseList } from "./parse.js";
import { workletVoice, isWorkletReady } from "./audio.js";
import { getQualityProfile } from "./quality.js";

// Truthy-string check — ACS values are strings, so "true"/"1"/"yes" all
// turn the flag on; "false"/"0" off; absent → off.
function flagOn(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

// ---------- shared graph helpers ----------
//
// WaveShaper curve cache: same drive constant produces the same curve
// every call. Pre-2026-05-03 we built a fresh 1024-sample Float32Array
// per trigger — for high-rate use (typing, slider drag) that's MB/sec
// of pointless allocation. Cache by (ctx, kind, drive) tuple.
const curveCache = new WeakMap(); // ctx → Map<key, Float32Array>
function getCurve(ctx, key, build) {
  let perCtx = curveCache.get(ctx);
  if (!perCtx) { perCtx = new Map(); curveCache.set(ctx, perCtx); }
  let curve = perCtx.get(key);
  if (!curve) {
    const cl = 1024;
    curve = new Float32Array(cl);
    for (let i = 0; i < cl; i++) {
      const x = (i / (cl - 1)) * 2 - 1;
      curve[i] = build(x);
    }
    perCtx.set(key, curve);
  }
  return curve;
}

function makeAsymWaveshape(ctx, drive = 1.2) {
  const ws = ctx.createWaveShaper();
  ws.curve = getCurve(ctx, `asym:${drive}`, (x) =>
    x >= 0 ? Math.tanh(x * drive) : Math.tanh(x * drive * 0.5) * 1.2
  );
  return ws;
}

function makeSaturator(ctx, drive) {
  const ws = ctx.createWaveShaper();
  ws.curve = getCurve(ctx, `sat:${drive}`, (x) => Math.tanh(x * (1 + drive * 3)));
  return ws;
}

// TPT (Topology-Preserving Transform) State Variable Filter coefficients.
// Vadim Zavalishin's design — 3 outputs (LP, BP, HP) from one structure,
// no zero-delay-feedback issues. We map to Web Audio's IIRFilter so we
// can use it as a static filter today; modulated cutoff requires the
// AudioWorklet path (separate runtime extension).
//
// For each mode we derive a 2nd-order IIR (b0,b1,b2 / 1,a1,a2) that
// matches the TPT structure's steady-state transfer function. This gives
// the same time-invariant response as the trapezoidal integrator design
// (more accurate cutoff prediction than RBJ cookbook biquads at high
// frequencies) without needing a custom worklet.
function tptSvfCoeffs(mode, freq, q, sr) {
  const w0 = 2 * Math.PI * freq / sr;
  const g = Math.tan(Math.min(Math.PI * 0.499, w0 / 2));
  const k = 1 / Math.max(0.5, q);
  // Bilinear-like normalized form for TPT SVF, expanded to RBJ-equivalent
  // biquad coefficients (matches Zavalishin Ch.5). a0 is the actual
  // denominator used for normalization below.
  const a0 = 1 + g * k + g * g;
  const a1 = 2 * (g * g - 1);
  const a2 = 1 - g * k + g * g;
  let b0, b1, b2;
  if (mode === "lp" || mode === "lowpass") {
    b0 = g * g; b1 = 2 * g * g; b2 = g * g;
  } else if (mode === "hp" || mode === "highpass") {
    b0 = 1; b1 = -2; b2 = 1;
  } else if (mode === "bp" || mode === "bandpass") {
    b0 = g * k; b1 = 0; b2 = -g * k;
  } else if (mode === "notch") {
    b0 = 1 + g * g; b1 = 2 * (g * g - 1); b2 = 1 + g * g;
  } else if (mode === "peak" || mode === "peaking") {
    b0 = 1 - g * g; b1 = 2 * (g * g - 1); b2 = 1 - g * g;
  } else {
    return null;
  }
  return {
    b: [b0 / a0, b1 / a0, b2 / a0],
    a: [1, a1 / a0, a2 / a0],
  };
}

// Build a static TPT-SVF filter node using Web Audio's IIRFilter.
// `mode` is one of: lp, hp, bp, notch, peak.
function makeTptFilter(ctx, mode, freq, q) {
  const c = tptSvfCoeffs(mode, freq, q, ctx.sampleRate);
  if (!c) return null;
  try {
    return ctx.createIIRFilter(c.b, c.a);
  } catch (e) {
    // Fallback to biquad if IIRFilter unsupported (very old browsers).
    const f = ctx.createBiquadFilter();
    f.type = mode === "lp" ? "lowpass" : mode === "hp" ? "highpass" :
             mode === "bp" ? "bandpass" : mode === "notch" ? "notch" : "peaking";
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
}

// PolyBLEP-style band-limited PeriodicWave cache. Web Audio's built-in
// "square" / "sawtooth" types use additive synthesis under the hood, but
// some implementations alias above ~10 kHz fundamentals. Building our
// own PeriodicWave with explicit harmonic limits guarantees no aliasing
// and gives identical behavior across browsers.
//
// The classic PolyBLEP correction (Välimäki 2007) is computed in the
// time domain — better suited to AudioWorklet. Here we use its frequency-
// domain equivalent: harmonic series truncated at Nyquist with the
// 1/n falloff that defines saw/square spectra. Identical perceptual
// result, achievable with stock OscillatorNode + setPeriodicWave.
const periodicWaveCache = new WeakMap();
function getPeriodicWave(ctx, type) {
  let perCtx = periodicWaveCache.get(ctx);
  if (!perCtx) {
    perCtx = {};
    periodicWaveCache.set(ctx, perCtx);
  }
  if (perCtx[type]) return perCtx[type];

  const N = 64; // first 64 harmonics — covers fundamental down to ~340 Hz
                // before the highest harmonic would exceed Nyquist (44.1k).
                // Web Audio resamples gracefully below this.
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  if (type === "sawtooth" || type === "saw") {
    for (let n = 1; n <= N; n++) imag[n] = -1 / n;
  } else if (type === "square") {
    for (let n = 1; n <= N; n += 2) imag[n] = 4 / (Math.PI * n);
  } else if (type === "triangle") {
    for (let n = 1; n <= N; n += 2) {
      imag[n] = (n % 4 === 1 ? 1 : -1) * 8 / (Math.PI * Math.PI * n * n);
    }
  } else {
    return null; // sine handled by built-in OscillatorNode
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  perCtx[type] = wave;
  return wave;
}

// Set oscillator type with anti-aliasing where applicable.
export function setOscType(osc, ctx, type) {
  if (type === "sine") {
    osc.type = "sine";
    return;
  }
  const wave = getPeriodicWave(ctx, type);
  if (wave) {
    osc.setPeriodicWave(wave);
    return;
  }
  // Unknown type — try Web Audio's built-in (works for legacy 'square'/etc).
  // If browser rejects, fall back to sine to avoid crashing the trigger.
  try { osc.type = type; }
  catch (e) { osc.type = "sine"; }
}

// Apply optional saturation + pan + connect to dest. Returns the new tail.
function applyTail(ctx, head, layer, dest) {
  let tail = head;
  if (layer.saturation || layer.drive) {
    const drive = parseFloat(layer.drive ?? layer.saturation ?? "1") || 1;
    const sat = makeSaturator(ctx, drive);
    tail.connect(sat);
    tail = sat;
  }
  if (layer.pan !== undefined) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, parseFloat(layer.pan) || 0));
    tail.connect(pn).connect(dest);
  } else {
    tail.connect(dest);
  }
}

function makeNoiseBuf(ctx, dur, kind, decayPow) {
  const sr = ctx.sampleRate;
  // Web Audio's createBuffer throws on length < 1. Clamp to at least one
  // sample for degenerate inputs (attack=0 + decay=0).
  const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(sr * dur)), sr);
  const ch = buf.getChannelData(0);
  if (kind === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < ch.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      const pink =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
      ch[i] = pink * Math.pow(1 - i / ch.length, decayPow);
    }
  } else {
    for (let i = 0; i < ch.length; i++) {
      ch[i] =
        (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, decayPow);
    }
  }
  return buf;
}

// ---------- layer source: modal ----------

export function playModalLayer(ctx, layer, opts) {
  const t = ctx.currentTime + parseTime(layer.start, 0);
  const { dest } = opts;
  const masterVol = opts.volume ?? 0.5;
  const pitchMul = opts.pitchMul ?? 1;
  const sr = ctx.sampleRate;
  const layerGain = (parseFloat(layer.gain ?? "1") || 1) * masterVol * 1.5;

  const fundamental = parseFreq(layer.modal, 440) * pitchMul;
  const ratiosFull = parseList(layer.ratios) || [1.0];
  const decaysFull = parseList(layer.decays) || [0.5];
  const gainsListFull = parseList(layer.gains) || [];
  // Quality profile may cap the number of modal partials. Truncating
  // from the tail loses high inharmonic shimmer first — perceptually
  // mild, CPU-significant on busy UIs.
  const partialCap = getQualityProfile().modalPartials;
  const ratios = ratiosFull.slice(0, partialCap);
  const decays = decaysFull.slice(0, partialCap);
  const gainsList = gainsListFull.slice(0, partialCap);

  // Opt-in worklet path — single-mode modal only. Sub-ms latency at the
  // cost of skipping the impulse-burst shaping and per-mode gain comp
  // that the main-thread path applies. Falls back to main-thread if the
  // worklet isn't ready or the layer is too complex (>1 ratio).
  if (flagOn(layer.realtime) && isWorkletReady() && ratios.length === 1 && !layer.filter) {
    workletVoice({
      kind: 2,
      freq: fundamental * (ratios[0] ?? 1),
      decay: decays[0] ?? 0.5,
      gain: layerGain,
      dest,
    });
    return;
  }

  const burstDur = 0.003;
  const burstBuf = ctx.createBuffer(1, Math.ceil(sr * burstDur), sr);
  const bch = burstBuf.getChannelData(0);
  for (let i = 0; i < bch.length; i++) {
    bch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bch.length, 0.5);
  }
  const burst = ctx.createBufferSource();
  burst.buffer = burstBuf;

  const shaper = makeAsymWaveshape(ctx);
  burst.connect(shaper);

  const out = ctx.createGain();
  out.gain.value = layerGain;

  // Built-in soft saturation on the modal output. Caps extreme peaks
  // (modal IIR can produce 100x+ amplification on resonant hits) so
  // the master limiter doesn't have to crush nonlinearly.
  //
  // Curve was tanh(x*8) — aggressive lift to keep high-freq bell modes
  // audible after calibration, but it added a metallic/buzzy edge that
  // notify/confirm/glass listeners could clearly hear vs. landing's
  // pure additive sine sum. Reduced to tanh(x*2): mild peak control,
  // near-linear in the small-signal range. If high-freq modes go too
  // quiet, raise per-preset gain or relax calibration target rather
  // than re-distorting the output.
  const innerSat = ctx.createWaveShaper();
  innerSat.curve = getCurve(ctx, "modalInner:2", (x) => Math.tanh(x * 2));
  out.connect(innerSat);
  applyTail(ctx, innerSat, layer, dest);

  ratios.forEach((ratio, i) => {
    const f = fundamental * ratio;
    const t60 = decays[i] ?? decays[decays.length - 1] ?? 0.5;
    const g = gainsList[i] ?? 1.0 / Math.sqrt(i + 1);
    const w = (2 * Math.PI * f) / sr;
    const r = Math.pow(0.001, 1 / (t60 * sr));
    const a1 = -2 * r * Math.cos(w);
    const a2 = r * r;
    // The differentiator b=[1,0,-1] has frequency-dependent numerator
    // gain = 2*sin(w). At low frequencies (660Hz → 0.17, 200Hz → 0.05)
    // this attenuates the modal output 6-20x; at high frequencies
    // (8kHz → 1.73) it slightly boosts. Compensate per-mode so all
    // modal frequencies hit similar amplitude — without this, bell-class
    // (660-1800Hz fundamentals) is inaudible vs hat-class (8kHz).
    const numComp = 1 / Math.max(0.05, 2 * Math.sin(w));
    try {
      const iir = ctx.createIIRFilter([1, 0, -1], [1, a1, a2]);
      const gn = ctx.createGain();
      gn.gain.value = g * numComp;
      shaper.connect(iir).connect(gn).connect(out);
    } catch (e) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 30;
      const gn = ctx.createGain();
      gn.gain.value = g * numComp;
      shaper.connect(bp).connect(gn).connect(out);
    }
  });

  burst.start(t);
  burst.stop(t + burstDur);
}

// ---------- layer source: additive sine sum ("tones") ----------
//
// Pure additive synthesis — each partial is its own sine oscillator
// with its own decay envelope, summed and sent through gain. No IIR
// resonator, no impulse burst, no inner waveshaper. Same shape as the
// landing audio-engine.js `modal()` function. Use this for clean,
// "professional" UI sounds (glass, bell, chime, notify, confirm,
// strings) where the impulse-driven modal IIR adds an unwanted
// metallic edge. For percussion bodies (kick, snare, thunk) keep the
// IIR `modal:` path — the impulse attack gives those their punch.
export function playTonesLayer(ctx, layer, opts) {
  const t = ctx.currentTime + parseTime(layer.start, 0);
  const { dest } = opts;
  const masterVol = opts.volume ?? 0.5;
  const pitchMul = opts.pitchMul ?? 1;
  const layerGain = (parseFloat(layer.gain ?? "1") || 1) * masterVol;

  const fundamental = parseFreq(layer.tones, 440) * pitchMul;
  const partialCap = getQualityProfile().modalPartials;
  const ratios = (parseList(layer.ratios) || [1.0]).slice(0, partialCap);
  const decays = (parseList(layer.decays) || [0.5]).slice(0, partialCap);
  const gainsList = (parseList(layer.gains) || []).slice(0, partialCap);
  const attack = parseTime(layer.attack, 0.001);

  // Opt-in worklet path — single-partial tones only (kind=0 sine tap).
  if (flagOn(layer.realtime) && isWorkletReady() && ratios.length === 1) {
    workletVoice({
      kind: 0,
      freq: fundamental * (ratios[0] ?? 1),
      decay: decays[0] ?? 0.5,
      gain: layerGain * (gainsList[0] ?? 1),
      dest,
    });
    return;
  }

  const out = ctx.createGain();
  out.gain.value = layerGain;
  applyTail(ctx, out, layer, dest);

  ratios.forEach((ratio, i) => {
    const f = fundamental * ratio;
    const d = decays[i] ?? decays[decays.length - 1] ?? 0.5;
    const g = gainsList[i] ?? 1.0 / Math.sqrt(i + 1);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(g, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + d);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + attack + d + 0.05);
  });
}

// ---------- layer source: Karplus-Strong pluck ----------

export function playPluckLayer(ctx, layer, opts) {
  const t = ctx.currentTime + parseTime(layer.start, 0);
  const { dest } = opts;
  const masterVol = opts.volume ?? 0.5;
  const pitchMul = opts.pitchMul ?? 1;
  const sr = ctx.sampleRate;
  const layerGain = (parseFloat(layer.gain ?? "1") || 1) * masterVol;

  // Pitch must be > 0 so the Karplus delay length stays finite. If user
  // writes pluck: 0hz, fall back to a low audible value rather than
  // crashing in Float32Array(Infinity).
  const pitch = Math.max(20, parseFreq(layer.pluck, 440) * pitchMul);
  const brightness = Math.max(
    0,
    Math.min(1, parseFloat(layer.brightness ?? "0.6"))
  );
  const decay = parseTime(layer.decay, 0.4);

  // Opt-in worklet path — pluck only, no per-layer filter (filter would
  // need to live on the worklet too; we keep it simple). Falls back to
  // main-thread when worklet isn't ready.
  if (flagOn(layer.realtime) && isWorkletReady() && !layer.filter) {
    workletVoice({
      kind: 3,
      freq: pitch,
      decay,
      gain: layerGain,
      extra: brightness,
      dest,
    });
    return;
  }

  const delaySamples = Math.max(2, Math.floor(sr / pitch));
  const total = Math.ceil(sr * Math.max(0.1, decay * 1.3));
  const delay = new Float32Array(delaySamples);
  for (let i = 0; i < delaySamples; i++) {
    delay[i] = Math.random() * 2 - 1;
  }
  const damp = 0.5 + brightness * 0.45;
  const roundTrips = Math.max(1, decay * pitch);
  const r = Math.pow(0.001, 1 / roundTrips);

  const buf = ctx.createBuffer(1, total, sr);
  const ch = buf.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < total; i++) {
    const idx = i % delaySamples;
    const cur = delay[idx];
    ch[i] = cur;
    delay[idx] = (cur * damp + prev * (1 - damp)) * r;
    prev = cur;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  let chainHead = src;
  if (layer.filter) {
    const f = ctx.createBiquadFilter();
    f.type = layer.filter;
    f.frequency.value = parseFreq(layer.cutoff, 8000);
    f.Q.value = parseFloat(layer.q ?? "0.7") || 0.7;
    src.connect(f);
    chainHead = f;
  }
  const g = ctx.createGain();
  g.gain.value = layerGain;
  chainHead.connect(g);
  applyTail(ctx, g, layer, dest);

  src.start(t);
  src.stop(t + decay * 1.3 + 0.05);
}

// ---------- layer source: noise / osc (default) ----------

export function playLayer(ctx, layer, opts) {
  if (layer.modal) return playModalLayer(ctx, layer, opts);
  if (layer.tones) return playTonesLayer(ctx, layer, opts);
  if (layer.pluck) return playPluckLayer(ctx, layer, opts);

  const t = ctx.currentTime + parseTime(layer.start, 0);
  const { dest } = opts;
  const masterVol = opts.volume ?? 0.5;
  const pitchMul = opts.pitchMul ?? 1;

  const attack = parseTime(layer.attack, 0.0005);
  const decay = parseTime(layer.decay, 0.05);
  const gain = (parseFloat(layer.gain ?? "1") || 1) * masterVol;
  const decayPow = parseFloat(layer.shape ?? "0.7") || 0.7;

  // Opt-in worklet path — simple osc:sine and lowpass-noise layers can
  // route through the worklet voice processor for sub-1 ms latency. Skip
  // when the layer needs anything the worklet doesn't replicate (FM,
  // pitch-from, detune, non-LP filters, non-sine osc).
  if (flagOn(layer.realtime) && isWorkletReady()) {
    const noFmDetuneSweep = !layer["fm-mod"] && !layer["pitch-from"] && layer.detune === undefined;
    if (layer.osc === "sine" && noFmDetuneSweep && !layer.filter) {
      workletVoice({
        kind: 0,
        freq: parseFreq(layer.freq, 440) * pitchMul,
        decay: attack + decay,
        gain,
        dest,
      });
      return;
    }
    if (!layer.osc && (layer.filter === "lowpass" || !layer.filter)) {
      // Filtered noise click — worklet's 1-pole LP centered at `freq`.
      // For unfiltered noise we still pass cutoff so the worklet's LP
      // sits high enough to be effectively transparent.
      workletVoice({
        kind: 1,
        freq: parseFreq(layer.cutoff, layer.filter ? 1000 : 12000),
        decay: attack + decay,
        gain,
        dest,
      });
      return;
    }
  }

  let src;
  let fmModSrc = null; // tracked separately so we can stop it
  if (layer.osc) {
    src = ctx.createOscillator();
    setOscType(src, ctx, layer.osc);
    const f = parseFreq(layer.freq, 440) * pitchMul;
    src.frequency.value = f;
    if (layer.detune !== undefined) {
      src.detune.value = parseFloat(layer.detune) || 0;
    }
    if (layer["pitch-from"]) {
      // Clamp startF away from zero — exponentialRampToValueAtTime
      // cannot start (or end) at 0 Hz, throws InvalidStateError.
      const startF = Math.max(1, parseFreq(layer["pitch-from"], f) * pitchMul);
      src.frequency.setValueAtTime(startF, t);
      src.frequency.exponentialRampToValueAtTime(
        Math.max(1, f),
        t + attack + decay * 0.5
      );
    }

    // FM modulation — attach a modulator oscillator to the carrier's
    // frequency Param. Defaults follow the SOUND_DESIGN.md tap recipe:
    // ratio 0.5, depth 80-100 for clicks/taps; ratio 2.5-3.5 for bells.
    if (layer["fm-mod"]) {
      fmModSrc = ctx.createOscillator();
      setOscType(fmModSrc, ctx, layer["fm-mod"]);
      const ratio = parseFloat(layer["fm-ratio"] ?? "2") || 2;
      const depth = parseFloat(layer["fm-depth"] ?? "100") || 100;
      fmModSrc.frequency.value = f * ratio;
      const fmGain = ctx.createGain();
      fmGain.gain.value = depth;
      fmModSrc.connect(fmGain).connect(src.frequency);
    }
  } else {
    const kind = layer.noise || "white";
    const dur = attack + decay;
    const buf = makeNoiseBuf(ctx, dur, kind, decayPow);
    src = ctx.createBufferSource();
    src.buffer = buf;
  }

  let chainHead = src;
  if (layer.filter) {
    const cutoffPitchMul = layer.osc ? 1 : pitchMul;
    const cutoff = parseFreq(layer.cutoff, 1000) * cutoffPitchMul;
    const q = parseFloat(layer.q ?? "0.7") || 0.7;
    let f;
    // `tpt-*` prefix opts into the TPT SVF topology (Zavalishin) — better
    // cutoff accuracy at high freq than RBJ biquads. Use the standard
    // names ("lowpass" etc.) for the default biquad path.
    if (/^tpt-/.test(layer.filter)) {
      const mode = layer.filter.slice(4);
      f = makeTptFilter(ctx, mode, cutoff, q);
    }
    if (!f) {
      f = ctx.createBiquadFilter();
      f.type = layer.filter;
      f.frequency.value = cutoff;
      f.Q.value = q;
    }
    chainHead.connect(f);
    chainHead = f;
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  chainHead.connect(g);
  applyTail(ctx, g, layer, dest);

  src.start(t);
  src.stop(t + attack + decay + 0.05);
  if (fmModSrc) {
    fmModSrc.start(t);
    fmModSrc.stop(t + attack + decay + 0.05);
  }
}

export function makeSoundFromLayers(layers) {
  return (ctx, opts) => {
    layers.forEach((layer) => playLayer(ctx, layer, opts));
  };
}

// ---------- inline synth(...) ----------

export function playSynth(ctx, cfg, opts) {
  const t = ctx.currentTime;
  const { dest, pitchMul = 1 } = opts;
  const vol = opts.volume ?? 0.4;

  const oscType = cfg.osc || "sine";
  const freq = parseFreq(cfg.freq, 440) * pitchMul;
  const attack = parseTime(cfg.attack, 0.005);
  const decay = parseTime(cfg.decay, 0.2);

  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(dest);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  env.connect(out);

  let chainHead = env;
  if (cfg.filter) {
    const filt = ctx.createBiquadFilter();
    filt.type = cfg.filter;
    filt.frequency.value = parseFreq(cfg.cutoff, 2000);
    filt.Q.value = parseFloat(cfg.q ?? "0.7");
    filt.connect(env);
    chainHead = filt;
  }

  const osc = ctx.createOscillator();
  setOscType(osc, ctx, oscType);
  osc.frequency.value = freq;
  if (cfg["pitch-from"]) {
    const startFreq = Math.max(1, parseFreq(cfg["pitch-from"], freq) * pitchMul);
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, freq),
      t + attack + decay * 0.5
    );
  }
  osc.connect(chainHead);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);

  if (cfg.noise) {
    const dur = Math.max(0.02, attack + decay * 0.4);
    const buf = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * dur),
      ctx.sampleRate
    );
    const ch = buf.getChannelData(0);
    if (cfg.noise === "pink") {
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < ch.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        ch[i] = b0 + b1 + b2 + w * 0.1848;
      }
    } else {
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const ng = ctx.createGain();
    ng.gain.value = parseFloat(cfg["noise-gain"] ?? "0.15");
    const nsrc = ctx.createBufferSource();
    nsrc.buffer = buf;
    nsrc.connect(ng).connect(chainHead);
    nsrc.start(t);
    nsrc.stop(t + dur);
  }
}

// ---------- url(...) sample playback ----------

const bufferCache = new Map(); // url → AudioBuffer | Promise<AudioBuffer>

function playBuffer(ctx, buffer, opts) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = opts.volume ?? 1;
  src.playbackRate.value = opts.pitchMul ?? 1;
  src.connect(g).connect(opts.dest);
  src.start();
}

export function playUrl(ctx, url, opts) {
  const cached = bufferCache.get(url);
  if (cached instanceof AudioBuffer) {
    playBuffer(ctx, cached, opts);
    return;
  }
  if (cached && typeof cached.then === "function") {
    // Already loading — chain this trigger to play when buffer arrives.
    cached.then((buf) => playBuffer(ctx, buf, opts)).catch(() => {});
    return;
  }
  // First time: start loading, AND queue this trigger to play on arrival.
  const promise = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => {
      bufferCache.set(url, buf);
      return buf;
    })
    .catch((e) => {
      bufferCache.delete(url);
      console.warn("[acs] failed to load", url, e);
      throw e;
    });
  bufferCache.set(url, promise);
  promise.then((buf) => playBuffer(ctx, buf, opts)).catch(() => {});
}
