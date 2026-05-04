/* audio.js — AudioContext lifecycle + per-room signal chains.
 *
 * Architecture:
 *
 *   trigger(roomName) → ensureRoomChain(roomName).input
 *
 *   roomChain {input}                            ┐
 *      ├─ dryGain                                │
 *      └─ convolver(IR for room) ─ wetGain  ─ ─ ─┴→ masterPost.eqLow
 *                                                       ↓
 *                                                    eqHigh
 *                                                       ↓
 *                                                    masterGain  (user volume)
 *                                                       ↓
 *                                                    limiter     (final safety)
 *                                                       ↓
 *                                                    destination
 *
 * Multiple room chains coexist; each preset trigger picks its room
 * via cascade (decls.room > defaultRoomName > "none"). This enables
 * per-element room overrides like:
 *
 *   :root         { room: medium-room; }
 *   dialog[open]  { room: small-room; }     // tighter inside modal
 */

import { parseDb, resolveVar } from "./parse.js";
import { setQuality, getQualityProfile } from "./quality.js";

let ctx = null;
let masterPost = null;
let defaultRoomName = "none";
const roomChains = new Map();

export function getCtx() {
  return ctx;
}

// Backward-compat shim: returns an object whose .input is the default
// room chain's entry point.
export function getMaster() {
  return {
    input: getDest(),
    masterGain: masterPost ? masterPost.masterGain : null,
    eqLow: masterPost ? masterPost.eqLow : null,
    eqHigh: masterPost ? masterPost.eqHigh : null,
    limiter: masterPost ? masterPost.limiter : null,
  };
}

let workletReady = null;
// Stash for :root master decls applied before the AudioContext exists.
// Browsers warn (and sometimes block) AudioContext creation prior to a
// user gesture. We defer the actual ctx creation until ensureCtx() is
// first called from a real user-driven path (trigger, picker preview),
// then flush the stash. See `configureMaster()` below.
let pendingMaster = null;

export function ensureCtx() {
  if (!ctx) {
    // latencyHint:'interactive' biases Web Audio toward small buffers
    // (~5 ms). Important for trigger feedback feel — default 'balanced'
    // may use 20+ ms buffers.
    const Ctor = window.AudioContext || window.webkitAudioContext;
    try {
      ctx = new Ctor({ latencyHint: "interactive" });
    } catch (e) {
      ctx = new Ctor();
    }
    masterPost = buildMasterPost(ctx);
    // Lazy-load AudioWorklet voice processor (low-latency UI sounds).
    if (ctx.audioWorklet) {
      const url = new URL("./worklets/click-processor.js", import.meta.url).href;
      workletReady = ctx.audioWorklet.addModule(url)
        .then(() => { workletReady.__ready = true; })
        .catch(() => null);
    }
    // Flush any :root master decls captured before ctx existed.
    if (pendingMaster) {
      const decls = pendingMaster;
      pendingMaster = null;
      applyMaster(decls);
    }
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Fire a worklet voice for sub-1 ms latency. `kind` selects synthesis:
//   0 = sine tap, 1 = noise click, 2 = modal tap, 3 = pluck (KS).
// `extra` is kind-specific (pluck → brightness 0..1).
// Returns true if dispatched (worklet ready), false if dropped silently.
export function workletVoice({
  freq = 2000, decay = 0.04, gain = 0.5,
  kind = 0, extra = 0.6, dest,
} = {}) {
  if (!ctx) ensureCtx();
  const target = dest || getDest();
  const make = () => {
    try {
      const node = new AudioWorkletNode(ctx, "acs-click", {
        parameterData: { freq, decay, gain, kind, extra },
      });
      node.connect(target);
    } catch (e) {
      // worklet not registered yet → silent fallback
    }
  };
  if (workletReady) workletReady.then(make);
  else make();
}

// Backwards-compat: pre-Phase-8.6 callers used workletClick({...kind}).
export function workletClick(opts = {}) {
  return workletVoice(opts);
}

// Semantic wrapper — worklet pluck (single Karplus-Strong voice).
export function workletPluck({ freq = 440, decay = 0.4, brightness = 0.6, gain = 0.5, dest } = {}) {
  return workletVoice({ freq, decay, gain, kind: 3, extra: brightness, dest });
}

// Semantic wrapper — worklet modal tap (single resonator).
export function workletModalTap({ freq = 1200, decay = 0.2, gain = 0.5, dest } = {}) {
  return workletVoice({ freq, decay, gain, kind: 2, dest });
}

// Whether the worklet has finished loading. Auto-routing in dsp.js checks
// this synchronously and falls back to main-thread when false.
export function isWorkletReady() {
  return workletReady && workletReady.__ready === true;
}

function buildMasterPost(c) {
  const eqLow = c.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 250;
  eqLow.gain.value = 0;
  const eqHigh = c.createBiquadFilter();
  eqHigh.type = "highshelf";
  eqHigh.frequency.value = 4000;
  eqHigh.gain.value = 0;

  // Safety-net limiter only — calibration aims peaks at -1.4 dBFS so
  // the limiter sees signal in its linear region. A high threshold
  // with gentle ratio means equal-loudness measured at calibrate-time
  // survives to the speakers. Earlier aggressive settings (-3 dB / 6:1)
  // crushed transient peaks more than sustains, breaking equal-loudness.
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 2;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;

  const masterGain = c.createGain();
  masterGain.gain.value = 1.0;

  // Order matters: masterGain (user volume knob) → limiter (final safety
  // net) → destination. Earlier order put masterGain AFTER the limiter,
  // which meant master-volume > 1.0 could push limited peaks past 0 dBFS
  // into hard digital clipping.
  eqLow.connect(eqHigh).connect(masterGain).connect(limiter).connect(c.destination);

  return { eqLow, eqHigh, limiter, masterGain };
}

const roomPresets = {
  none: null,
  "small-room": { duration: 0.35, decay: 2.5, mix: 0.18 },
  "medium-room": { duration: 0.9, decay: 2.0, mix: 0.22 },
  "large-hall": { duration: 2.4, decay: 1.6, mix: 0.28 },
  chamber: { duration: 0.6, decay: 3.0, mix: 0.20 },
  // Dattorro plate reverb topology — denser early diffusion, more
  // realistic late field. Use `room: plate` for a "sounds like a real
  // 80s plate reverb unit" character.
  plate: { duration: 1.6, decay: 2.2, mix: 0.25, algorithm: "dattorro" },
};

// Schroeder-Moorer algorithmic reverb IR generator.
//   4 parallel comb filters (different prime delays) → sum
//   → 2 series Schroeder allpass filters → output
// Produces a more natural reverb than pure decaying noise — preserves
// echo density buildup characteristics of real rooms.
// Per-channel decorrelation via different delay seeds for stereo width.
function schroederIR(len, sr, decayParam, channelOffset) {
  // Prime-spaced comb delays in milliseconds (Moorer's classic values
  // adjusted for room scale). Larger delays = bigger room.
  const scale = decayParam < 2.5 ? 1.2 : 1.5;
  const combDelaysMs = [29.7, 37.1, 41.1, 43.7].map(
    (d) => d * scale + channelOffset
  );
  const allpassDelaysMs = [5.0, 1.7];

  // Comb gain controls reverb time — higher = longer ring-out.
  const t60 = decayParam * 0.4 + 0.5;
  const combGains = combDelaysMs.map((dms) =>
    Math.pow(0.001, (dms / 1000) / t60)
  );

  // Build comb output by direct DSP loop.
  const combs = combDelaysMs.map((dms, i) => {
    const D = Math.max(1, Math.floor((dms / 1000) * sr));
    const out = new Float32Array(len);
    const buf = new Float32Array(D);
    let writeIdx = 0;
    for (let n = 0; n < len; n++) {
      const x = n === 0 ? 1.0 : 0; // unit impulse
      const delayed = buf[writeIdx];
      const y = x + combGains[i] * delayed;
      buf[writeIdx] = y;
      out[n] = y;
      writeIdx = (writeIdx + 1) % D;
    }
    return out;
  });

  // Sum and normalize.
  const summed = new Float32Array(len);
  for (let n = 0; n < len; n++) {
    let s = 0;
    for (const c of combs) s += c[n];
    summed[n] = s * 0.25;
  }

  // Series Schroeder allpasses: y[n] = -g·x[n] + x[n-D] + g·y[n-D]
  let signal = summed;
  for (const apMs of allpassDelaysMs) {
    const D = Math.max(1, Math.floor((apMs / 1000) * sr));
    const g = 0.7;
    const out = new Float32Array(len);
    const xBuf = new Float32Array(D);
    const yBuf = new Float32Array(D);
    let idx = 0;
    for (let n = 0; n < len; n++) {
      const x = signal[n];
      const xd = xBuf[idx];
      const yd = yBuf[idx];
      const y = -g * x + xd + g * yd;
      xBuf[idx] = x;
      yBuf[idx] = y;
      out[n] = y;
      idx = (idx + 1) % D;
    }
    signal = out;
  }

  // Damping: mild lowpass over the tail to simulate air absorption.
  const damped = new Float32Array(len);
  let prev = 0;
  for (let n = 0; n < len; n++) {
    const t = n / len;
    const damping = 0.2 + 0.4 * t;
    damped[n] = signal[n] * (1 - damping) + prev * damping;
    prev = damped[n];
  }
  return damped;
}

// Dattorro plate reverb (1997 paper "Effect Design Part 1") — input
// diffusion (4 series allpass) → tank (2 parallel feedback loops with
// allpass + delay + lowpass damping). Renders the impulse response into
// stereo output buffers; we then feed that IR to a ConvolverNode.
//
// Coefficients are scaled from Dattorro's 29.761 kHz reference to the
// runtime sample rate.
function dattorroIR(len, sr, decayParam, side /* 0 or 1 */) {
  const out = new Float32Array(len);
  const scale = sr / 29761;
  // Input diffusion allpass delays (samples) and gains.
  const idDelays = [142, 107, 379, 277].map((d) => Math.max(1, Math.round(d * scale)));
  const idGains = [0.75, 0.75, 0.625, 0.625];
  // Tank delays — a/b for the two loops. Modulated allpasses in the
  // original; here we use static delays for simplicity (still gives
  // characteristic Dattorro density).
  const tankAP_a = Math.round(672 * scale), tankAP_b = Math.round(908 * scale);
  const tankD_a = Math.round(4453 * scale), tankD_b = Math.round(3720 * scale);
  const tankAP2_a = Math.round(1800 * scale), tankAP2_b = Math.round(2656 * scale);
  const tankD2_a = Math.round(4217 * scale), tankD2_b = Math.round(3163 * scale);
  // Decay coefficient: t60 → loop gain.
  const t60 = decayParam;
  const totalLoopSamples = tankAP_a + tankD_a + tankAP2_a + tankD2_a;
  const decayGain = Math.pow(0.001, totalLoopSamples / (t60 * sr));
  const damping = 0.0005; // 1-pole LP coefficient (more = duller tail)
  const bandwidth = 0.9995; // input bandwidth 1-pole LP

  // State buffers.
  const idBufs = idDelays.map((d) => new Float32Array(d));
  const idIdx = idDelays.map(() => 0);
  const apABuf = new Float32Array(tankAP_a);
  const apBBuf = new Float32Array(tankAP_b);
  const dABuf = new Float32Array(tankD_a);
  const dBBuf = new Float32Array(tankD_b);
  const ap2ABuf = new Float32Array(tankAP2_a);
  const ap2BBuf = new Float32Array(tankAP2_b);
  const d2ABuf = new Float32Array(tankD2_a);
  const d2BBuf = new Float32Array(tankD2_b);
  let apA = 0, apB = 0, dA = 0, dB = 0, ap2A = 0, ap2B = 0, d2A = 0, d2B = 0;
  let bandLP = 0, lpA = 0, lpB = 0;
  let loopA = 0, loopB = 0;

  for (let n = 0; n < len; n++) {
    let x = n === 0 ? 1.0 : 0;
    // Input bandwidth LP.
    bandLP = bandLP + bandwidth * (x - bandLP);
    let s = bandLP;
    // 4 series allpasses.
    for (let i = 0; i < 4; i++) {
      const buf = idBufs[i], idx = idIdx[i], g = idGains[i];
      const d = buf[idx];
      const y = -g * s + d;
      buf[idx] = s + g * y;
      idIdx[i] = (idx + 1) % buf.length;
      s = y;
    }
    // Tank: split into two loops cross-feeding each other.
    let inA = s + decayGain * loopB;
    let inB = s + decayGain * loopA;
    // Loop A: allpass → delay → LP → allpass2 → delay2.
    {
      const d = apABuf[apA];
      const y = -0.7 * inA + d;
      apABuf[apA] = inA + 0.7 * y;
      apA = (apA + 1) % apABuf.length;
      inA = y;
    }
    {
      const d = dABuf[dA];
      dABuf[dA] = inA;
      dA = (dA + 1) % dABuf.length;
      inA = d;
    }
    lpA = lpA + damping * (inA - lpA);
    inA = lpA;
    {
      const d = ap2ABuf[ap2A];
      const y = 0.5 * inA + d;
      ap2ABuf[ap2A] = inA - 0.5 * y;
      ap2A = (ap2A + 1) % ap2ABuf.length;
      inA = y;
    }
    {
      const d = d2ABuf[d2A];
      d2ABuf[d2A] = inA;
      d2A = (d2A + 1) % d2ABuf.length;
      inA = d;
    }
    loopA = inA;
    // Loop B: same structure with B-tunings.
    {
      const d = apBBuf[apB];
      const y = -0.7 * inB + d;
      apBBuf[apB] = inB + 0.7 * y;
      apB = (apB + 1) % apBBuf.length;
      inB = y;
    }
    {
      const d = dBBuf[dB];
      dBBuf[dB] = inB;
      dB = (dB + 1) % dBBuf.length;
      inB = d;
    }
    lpB = lpB + damping * (inB - lpB);
    inB = lpB;
    {
      const d = ap2BBuf[ap2B];
      const y = 0.5 * inB + d;
      ap2BBuf[ap2B] = inB - 0.5 * y;
      ap2B = (ap2B + 1) % ap2BBuf.length;
      inB = y;
    }
    {
      const d = d2BBuf[d2B];
      d2BBuf[d2B] = inB;
      d2B = (d2B + 1) % d2BBuf.length;
      inB = d;
    }
    loopB = inB;
    // Output taps — Dattorro mixes various delay-line points for L/R.
    out[n] = (side === 0)
      ? (apABuf[(apA + 266) % apABuf.length] + dBBuf[(dB + 1191) % dBBuf.length] - ap2BBuf[(ap2B + 187) % ap2BBuf.length]) * 0.6
      : (apBBuf[(apB + 353) % apBBuf.length] + dABuf[(dA + 1066) % dABuf.length] - ap2ABuf[(ap2A + 121) % ap2ABuf.length]) * 0.6;
  }
  // Normalize so peak ≤ 0.95 (room for convolution headroom).
  let peak = 0;
  for (let i = 0; i < len; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i]);
  if (peak > 0) {
    const k = 0.95 / peak;
    for (let i = 0; i < len; i++) out[i] *= k;
  }
  return out;
}

function makeIR(c, duration, decay, algorithm) {
  const sr = c.sampleRate;
  // Quality profile may shorten the IR — `low` saves a chunk of CPU on
  // every preset trigger that hits a reverb (convolution scales with IR
  // length). Decay (RT60) intent is preserved; only the rendered tail
  // length shortens, so the room sounds slightly drier.
  const scale = getQualityProfile().reverbScale;
  const len = Math.floor(sr * duration * scale);
  const ir = c.createBuffer(2, len, sr);
  if (algorithm === "dattorro") {
    ir.getChannelData(0).set(dattorroIR(len, sr, decay, 0));
    ir.getChannelData(1).set(dattorroIR(len, sr, decay, 1));
  } else {
    // Stereo decorrelation via small per-channel delay offsets.
    ir.getChannelData(0).set(schroederIR(len, sr, decay, 0));
    ir.getChannelData(1).set(schroederIR(len, sr, decay, 0.7));
  }
  return ir;
}

function buildRoomChain(c, roomName, mixOverride) {
  const input = c.createGain();
  const dry = c.createGain();
  const conv = c.createConvolver();
  const wet = c.createGain();

  const preset = roomPresets[roomName];
  if (preset) {
    conv.buffer = makeIR(c, preset.duration, preset.decay, preset.algorithm);
    const mix = isFinite(mixOverride) ? mixOverride : preset.mix;
    wet.gain.value = mix;
    dry.gain.value = 1 - mix * 0.5;
  } else {
    wet.gain.value = 0;
    dry.gain.value = 1;
  }

  input.connect(dry).connect(masterPost.eqLow);
  input.connect(conv).connect(wet).connect(masterPost.eqLow);

  return { input, dry, conv, wet, name: roomName };
}

export function ensureRoomChain(roomName, mixOverride) {
  if (!ctx) ensureCtx();
  if (roomChains.has(roomName)) return roomChains.get(roomName);
  const chain = buildRoomChain(ctx, roomName, mixOverride);
  roomChains.set(roomName, chain);
  return chain;
}

// Resolve a room name (or undefined for default) → input AudioNode.
export function getDest(roomName) {
  if (!ctx) ensureCtx();
  const name =
    roomName && roomPresets.hasOwnProperty(roomName) ? roomName : defaultRoomName;
  return ensureRoomChain(name).input;
}

export function configureMaster(rootDecls) {
  // No ctx yet → stash and bail. ensureCtx() will flush this once a
  // real user gesture has unlocked Web Audio. Calling new
  // AudioContext() here would log a noisy autoplay-policy warning.
  if (!ctx) {
    pendingMaster = rootDecls;
    return;
  }
  applyMaster(rootDecls);
}

function applyMaster(rootDecls) {
  // String-typed master decls (room, quality) must go through the var()
  // resolver — numeric ones already do via parseDb / parseFloat below.
  const room = resolveVar(rootDecls["room"]);
  const roomMixOverride = parseFloat(resolveVar(rootDecls["room-mix"]));
  const masterVol = parseFloat(resolveVar(rootDecls["master-volume"]));
  const eqLow = parseDb(rootDecls["master-eq-low"]);
  const eqHigh = parseDb(rootDecls["master-eq-high"]);
  // Quality knob — applied before any room rebuilds below so a fresh
  // chain picks up the new reverb scale.
  setQuality(resolveVar(rootDecls["quality"] ?? "medium"));

  // Apply OR reset to default. Earlier we only applied when set, which
  // meant theme switches left stale EQ values: switching from a theme
  // that boosted low to one that doesn't would keep the boost.
  masterPost.masterGain.gain.value = isFinite(masterVol) ? masterVol : 1.0;
  masterPost.eqLow.gain.value = isFinite(eqLow) ? eqLow : 0;
  masterPost.eqHigh.gain.value = isFinite(eqHigh) ? eqHigh : 0;

  if (room && roomPresets.hasOwnProperty(room)) {
    defaultRoomName = room;
    // Re-build default chain if it exists with a possibly different mix.
    if (roomChains.has(room)) {
      const old = roomChains.get(room);
      try { old.input.disconnect(); } catch (e) {}
      try { old.dry.disconnect(); } catch (e) {}
      try { old.conv.disconnect(); } catch (e) {}
      try { old.wet.disconnect(); } catch (e) {}
      roomChains.delete(room);
    }
    ensureRoomChain(room, roomMixOverride);
  } else {
    // No room specified — reset to dry. Earlier we left defaultRoomName
    // at whatever the previous theme set, so loading a stylesheet without
    // :root { room } would inherit a reverb the new sheet didn't ask for.
    defaultRoomName = "none";
  }
}
