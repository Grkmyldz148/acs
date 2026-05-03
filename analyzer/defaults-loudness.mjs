/* defaults-loudness.mjs — verify auto-calibration produces equal loudness.
 *
 * Renders every @sound in defaults.acs, runs it through the same K-weighting
 * + active-region RMS measurement that calibrate.js uses, computes the
 * factor each preset would receive, then rerenders post-factor and reports
 * the post-calibration loudness spread.
 *
 * Usage: node analyzer/defaults-loudness.mjs
 *
 * This re-uses showcase-loudness.mjs's renderer by importing its layer
 * helpers — but since that file is a script, we copy the minimal pieces.
 */

import { readFileSync } from "node:fs";

const SR = 48000;
const DURATION = 1.5;
const N = Math.ceil(SR * DURATION);
const VOLUME = 0.5;

// Calibration knobs (mirror calibrate.js).
const TARGET_RMS = 0.30;
const TARGET_PEAK = 1.8;
const ACTIVE_THRESHOLD_RATIO = 0.02;
const FACTOR_MAX = 20.0;
function durationCompensation(activeDurationSec) {
  if (activeDurationSec >= 0.2) return 1.0;
  if (activeDurationSec <= 0.005) return 1.5;
  const t = (0.2 - activeDurationSec) / 0.195;
  return 1.0 + 0.5 * t;
}

// ---- Minimal copy of DSP primitives from showcase-loudness.mjs ----

function zeros(n) { return new Float32Array(n); }
function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
function noiseBufWhite(dur, decayPow, seed) {
  const len = Math.ceil(SR * dur);
  const out = zeros(len);
  const rng = makeRng(seed);
  for (let i = 0; i < len; i++) out[i] = rng() * Math.pow(1 - i / len, decayPow);
  return out;
}
function noiseBufPink(dur, decayPow, seed) {
  const len = Math.ceil(SR * dur);
  const out = zeros(len);
  const rng = makeRng(seed);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < len; i++) {
    const w = rng();
    b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
    const pink = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
    b6 = w * 0.115926;
    out[i] = pink * Math.pow(1 - i / len, decayPow);
  }
  return out;
}
function biquad(input, type, freq, q, gainDb) {
  const w0 = (2 * Math.PI * freq) / SR;
  const cosw = Math.cos(w0), sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);
  let b0,b1,b2,a0,a1,a2;
  if (type === "lowpass")    { b0=(1-cosw)/2; b1=1-cosw; b2=(1-cosw)/2; a0=1+alpha; a1=-2*cosw; a2=1-alpha; }
  else if (type === "highpass"){ b0=(1+cosw)/2; b1=-(1+cosw); b2=(1+cosw)/2; a0=1+alpha; a1=-2*cosw; a2=1-alpha; }
  else if (type === "bandpass"){ b0=alpha; b1=0; b2=-alpha; a0=1+alpha; a1=-2*cosw; a2=1-alpha; }
  else if (type === "highshelf"){
    const A = Math.pow(10, gainDb / 40);
    const beta = Math.sqrt(A) / q;
    b0 =    A*((A+1) + (A-1)*cosw + beta*sinw);
    b1 = -2*A*((A-1) + (A+1)*cosw);
    b2 =    A*((A+1) + (A-1)*cosw - beta*sinw);
    a0 =       (A+1) - (A-1)*cosw + beta*sinw;
    a1 =    2*((A-1) - (A+1)*cosw);
    a2 =       (A+1) - (A-1)*cosw - beta*sinw;
  }
  else {
    // Unsupported filter type (lowshelf, notch, peaking, allpass, tpt-*).
    // Pass-through rather than crash the bake — user may bring it later.
    return input;
  }
  b0/=a0; b1/=a0; b2/=a0; a1/=a0; a2/=a0;
  const out = zeros(input.length);
  let x1=0,x2=0,y1=0,y2=0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2;
    out[i] = y; x2=x1; x1=x; y2=y1; y1=y;
  }
  return out;
}
function modeFilter(input, freq, t60) {
  const w = (2 * Math.PI * freq) / SR;
  const r = Math.pow(0.001, 1 / (t60 * SR));
  const a1 = -2 * r * Math.cos(w), a2 = r*r;
  const out = zeros(input.length);
  let x1=0,x2=0,y1=0,y2=0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = x - x2 - a1*y1 - a2*y2;
    out[i] = y; x2=x1; x1=x; y2=y1; y1=y;
  }
  return out;
}
function asymWaveshape(buf, drive = 1.2) {
  const out = zeros(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] * drive;
    out[i] = x >= 0 ? Math.tanh(x) : Math.tanh(x * 0.5) * 1.2;
  }
  return out;
}
function saturate(buf, drive) {
  const k = 1 + drive * 3;
  const out = zeros(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = Math.tanh(buf[i] * k);
  return out;
}
function applyEnvelope(buf, attack, decay, gain) {
  const out = zeros(N);
  const len = Math.min(buf.length, N);
  const aSamp = Math.max(1, Math.floor(attack * SR));
  const dEnd = Math.min(N, aSamp + Math.floor(decay * SR));
  const lnRatio = Math.log(0.0001 / Math.max(1e-6, gain));
  for (let i = 0; i < Math.min(aSamp, len); i++) out[i] = buf[i] * (i / aSamp) * gain;
  for (let i = aSamp; i < Math.min(dEnd, len); i++) {
    const a = (i - aSamp) / Math.max(1, dEnd - aSamp);
    out[i] = buf[i] * gain * Math.exp(lnRatio * a);
  }
  return out;
}
function add(into, src) {
  const len = Math.min(into.length, src.length);
  for (let i = 0; i < len; i++) into[i] += src[i];
}

function renderModalLayer(layer, volume, seed) {
  const layerGain = (parseFloat(layer.gain ?? "1") || 1) * volume * 1.5;
  const fundamental = parseFreq(layer.modal, 440);
  const ratios = parseList(layer.ratios) ?? [1.0];
  const decays = parseList(layer.decays) ?? [0.5];
  const gainsList = parseList(layer.gains) ?? [];
  const burstDur = 0.003;
  const burstBuf = zeros(Math.ceil(SR * burstDur));
  const rng = makeRng(seed);
  for (let i = 0; i < burstBuf.length; i++) burstBuf[i] = rng() * Math.pow(1 - i / burstBuf.length, 0.5);
  const exc = asymWaveshape(burstBuf, 1.2);
  const excPadded = zeros(N);
  for (let i = 0; i < exc.length; i++) excPadded[i] = exc[i];
  const sum = zeros(N);
  ratios.forEach((ratio, i) => {
    const f = fundamental * ratio;
    const t60 = decays[i] ?? decays[decays.length - 1] ?? 0.5;
    const g = gainsList[i] ?? 1.0 / Math.sqrt(i + 1);
    const w = (2 * Math.PI * f) / SR;
    const numComp = 1 / Math.max(0.05, 2 * Math.sin(w));
    const partial = modeFilter(excPadded, f, t60);
    for (let j = 0; j < N; j++) sum[j] += partial[j] * g * numComp;
  });
  let out = sum;
  // Match runtime: layerGain → inner tanh(*2) saturation → optional drive.
  // Was tanh(*8) — softened to (*2) on 2026-05-03 to match landing's
  // cleaner additive sound character. Analyzer must mirror exactly or
  // calibration factors diverge from runtime behavior.
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * layerGain * 2);
  if (layer.drive || layer.saturation) {
    const drv = parseFloat(layer.drive ?? layer.saturation ?? "1") || 1;
    out = saturate(out, drv);
  }
  return out;
}

// Additive sine-sum partial layer — mirrors runtime dsp.js playTonesLayer.
// Each partial is an independent sine with its own decay envelope.
// Applies saturation/drive at the end (like runtime's applyTail).
function renderTonesLayer(layer, volume, _seed) {
  const layerGain = (parseFloat(layer.gain ?? "1") || 1) * volume;
  const fundamental = parseFreq(layer.tones, 440);
  const ratios = parseList(layer.ratios) ?? [1.0];
  const decays = parseList(layer.decays) ?? [0.5];
  const gainsList = parseList(layer.gains) ?? [];
  const attack = parseTime(layer.attack, 0.001);
  let out = zeros(N);
  ratios.forEach((ratio, i) => {
    const f = fundamental * ratio;
    const d = decays[i] ?? decays[decays.length - 1] ?? 0.5;
    const g = gainsList[i] ?? 1.0 / Math.sqrt(i + 1);
    const aSamp = Math.max(1, Math.floor(attack * SR));
    const dEnd = Math.min(N, aSamp + Math.floor(d * SR));
    const lnRatio = Math.log(0.0001 / Math.max(1e-6, g));
    const omega = 2 * Math.PI * f / SR;
    for (let j = 0; j < Math.min(aSamp, N); j++) {
      out[j] += Math.sin(omega * j) * (j / aSamp) * g * layerGain;
    }
    for (let j = aSamp; j < Math.min(dEnd, N); j++) {
      const a = (j - aSamp) / Math.max(1, dEnd - aSamp);
      out[j] += Math.sin(omega * j) * g * layerGain * Math.exp(lnRatio * a);
    }
  });
  if (layer.drive || layer.saturation) {
    const drv = parseFloat(layer.drive ?? layer.saturation ?? "1") || 1;
    out = saturate(out, drv);
  }
  return out;
}
function renderNoiseLayer(layer, volume, seed) {
  const attack = parseTime(layer.attack, 0.0005);
  const decay = parseTime(layer.decay, 0.05);
  const gain = (parseFloat(layer.gain ?? "1") || 1) * volume;
  const decayPow = parseFloat(layer.shape ?? "0.7") || 0.7;
  const dur = attack + decay;
  const kind = layer.noise || "white";
  const noise = kind === "pink" ? noiseBufPink(dur, decayPow, seed) : noiseBufWhite(dur, decayPow, seed);
  let chain = noise;
  if (layer.filter) chain = biquad(chain, layer.filter, parseFreq(layer.cutoff, 1000), parseFloat(layer.q ?? "0.7"));
  let out = applyEnvelope(chain, attack, decay, gain);
  if (layer.drive || layer.saturation) {
    const drv = parseFloat(layer.drive ?? layer.saturation ?? "1") || 1;
    out = saturate(out, drv);
  }
  return out;
}
function renderOscLayer(layer, volume) {
  const attack = parseTime(layer.attack, 0.0005);
  const decay = parseTime(layer.decay, 0.05);
  const gain = (parseFloat(layer.gain ?? "1") || 1) * volume;
  const f = parseFreq(layer.freq, 440);
  const startF = layer["pitch-from"] ? parseFreq(layer["pitch-from"], f) : f;
  const sweepEnd = attack + decay * 0.5;
  const fmRatio = parseFloat(layer["fm-ratio"] ?? "2") || 2;
  const fmDepth = parseFloat(layer["fm-depth"] ?? "100") || 100;
  const useFm = !!layer["fm-mod"];
  const fmType = layer["fm-mod"] || "sine";
  const total = Math.ceil(SR * (attack + decay + 0.01));
  const raw = zeros(total);
  let phase = 0, fmPhase = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let curF;
    if (layer["pitch-from"]) {
      if (t < sweepEnd && sweepEnd > 0) {
        const a = t / sweepEnd;
        curF = startF * Math.pow(f / startF, a);
      } else curF = f;
    } else curF = f;
    let mod = 0;
    if (useFm) {
      const fmF = f * fmRatio;
      mod = oscSample(fmType, fmPhase) * fmDepth;
      fmPhase += (2 * Math.PI * fmF) / SR;
    }
    raw[i] = oscSample(layer.osc, phase);
    phase += (2 * Math.PI * (curF + mod)) / SR;
  }
  let chain = raw;
  if (layer.filter) chain = biquad(chain, layer.filter, parseFreq(layer.cutoff, 1000), parseFloat(layer.q ?? "0.7"));
  let out = applyEnvelope(chain, attack, decay, gain);
  if (layer.drive || layer.saturation) {
    const drv = parseFloat(layer.drive ?? layer.saturation ?? "1") || 1;
    out = saturate(out, drv);
  }
  return out;
}
function oscSample(type, phase) {
  const p = phase / (2 * Math.PI);
  const frac = p - Math.floor(p);
  if (type === "sine") return Math.sin(phase);
  if (type === "square") return frac < 0.5 ? 1 : -1;
  if (type === "triangle") return frac < 0.5 ? (4 * frac - 1) : (3 - 4 * frac);
  if (type === "saw" || type === "sawtooth") return 2 * frac - 1;
  return Math.sin(phase);
}
function renderPluckLayer(layer, volume, seed) {
  const layerGain = (parseFloat(layer.gain ?? "1") || 1) * volume;
  // Pitch must be > 0 — same defensive guard as runtime dsp.js.
  const pitch = Math.max(20, parseFreq(layer.pluck, 440));
  const brightness = clamp(parseFloat(layer.brightness ?? "0.6"), 0, 1);
  const decay = parseTime(layer.decay, 0.4);
  const delaySamples = Math.max(2, Math.floor(SR / pitch));
  const total = Math.min(N, Math.ceil(SR * Math.max(0.1, decay * 1.3)));
  const delay = new Float32Array(delaySamples);
  const rng = makeRng(seed);
  for (let i = 0; i < delaySamples; i++) delay[i] = rng();
  const damp = 0.5 + brightness * 0.45;
  const roundTrips = Math.max(1, decay * pitch);
  const r = Math.pow(0.001, 1 / roundTrips);
  const out = zeros(N);
  let prev = 0;
  for (let i = 0; i < total; i++) {
    const idx = i % delaySamples;
    const cur = delay[idx];
    out[i] = cur;
    delay[idx] = (cur * damp + prev * (1 - damp)) * r;
    prev = cur;
  }
  for (let i = 0; i < total; i++) out[i] *= layerGain;
  return out;
}
function renderLayer(layer, volume, seed) {
  if (layer.modal) return renderModalLayer(layer, volume, seed);
  if (layer.tones) return renderTonesLayer(layer, volume, seed);
  if (layer.pluck) return renderPluckLayer(layer, volume, seed);
  if (layer.osc)   return renderOscLayer(layer, volume);
  return renderNoiseLayer(layer, volume, seed);
}

// Sum a layer buffer into `into` with optional `start:` offset (samples).
// Mirrors runtime which schedules each layer at `t + parseTime(layer.start)`.
function addWithOffset(into, src, layer) {
  const offsetSec = parseTime(layer.start, 0);
  const offsetSamples = Math.max(0, Math.floor(offsetSec * SR));
  const len = Math.min(into.length - offsetSamples, src.length);
  for (let i = 0; i < len; i++) into[i + offsetSamples] += src[i];
}

function parseFreq(v, def = 440) {
  if (v == null) return def;
  const m = String(v).trim().match(/^([\d.]+)\s*(k?hz)?$/i);
  if (!m) return def;
  return parseFloat(m[1]) * (/^k/i.test(m[2] ?? "") ? 1000 : 1);
}
function parseTime(v, def = 0.05) {
  if (v == null) return def;
  const s = String(v).trim();
  if (s.endsWith("ms")) return parseFloat(s) / 1000;
  if (s.endsWith("s")) return parseFloat(s);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : def;
}
function parseList(v) {
  if (v == null) return null;
  return String(v).split(/[,\s]+/).map((x) => parseFloat(x)).filter(Number.isFinite);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, ""); }

function extractSoundBlocks(src) {
  const out = [];
  const re = /@sound\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const start = re.lastIndex;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "{") depth++; else if (c === "}") depth--;
      i++;
    }
    if (depth === 0) { out.push({ name, body: src.slice(start, i - 1) }); re.lastIndex = i; }
    else break;
  }
  return out;
}
function parseLayers(body) {
  const layers = [];
  const re = /([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(body))) {
    const layerName = m[1];
    const start = re.lastIndex;
    let depth = 1, i = start;
    while (i < body.length && depth > 0) {
      const c = body[i];
      if (c === "{") depth++; else if (c === "}") depth--;
      i++;
    }
    if (depth !== 0) break;
    const propsText = body.slice(start, i - 1);
    const props = {};
    propsText.split(";").forEach((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 0) return;
      const k = decl.slice(0, idx).trim();
      const v = decl.slice(idx + 1).trim();
      if (k) props[k] = v;
    });
    layers.push({ name: layerName, ...props });
    re.lastIndex = i;
  }
  return layers;
}

// ---- K-weighting + active-region RMS (mirror calibrate.js) ----

function kWeight(buf) {
  // Match calibrate.js: highpass 200Hz (kill sub-bass small speakers
  // can't reproduce) + highshelf +4dB @ 1500Hz.
  let out = biquad(buf, "highpass", 200, 0.7);
  out = biquad(out, "highshelf", 1500, 1.0, 4);
  return out;
}

function classify(name) {
  if (/^(click|tap|tick|pop|keystroke)/.test(name)) return "click";
  if (/^(modal|drawer|dropdown|page)-/.test(name)) return "transition";
  if (/^toggle-/.test(name)) return "toggle";
  if (/^(kick|snare|hat|clap|thunk|knock|woodblock)$/.test(name)) return "percussion";
  if (/^(success|complete|confirm|error|denied|prompt|buzz)$/.test(name)) return "feedback";
  if (/^(notify|ding|mention|badge)$/.test(name)) return "notification";
  if (/^(bell|chime|glass|ting|gong|carriage-return|old-bell)/.test(name)) return "bell";
  if (/^(pluck|string)/.test(name)) return "string";
  if (/^(whoosh|swoosh|sparkle|ping)$/.test(name)) return "texture";
  return "default";
}
// Per-class loudness budget. MUST match poc/runtime/calibrate.js's
// CLASS_TARGET_MULT — runtime applies the same multiplier when calibrating
// USER-defined @sound presets. Diverging here means built-in baked factors
// don't match runtime's intended class loudness contour.
const CLASS_MULT = {
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

const PRESET_MULT = {
  "page-enter": 1.20,
  "page-exit": 1.10,
  gong: 1.20,
  error: 1.15,
  buzz: 1.10,
  tick: 0.80,
  confirm: 0.85,
  prompt: 0.85,
  ting: 0.85,
  "dropdown-open": 0.85,
  "dropdown-close": 0.85,
  "toggle-on": 0.90,
  "toggle-off": 0.90,
};

function measureCalibration(buf, name) {
  const weighted = kWeight(buf);
  let kPeak = 0;
  for (let i = 0; i < weighted.length; i++) {
    const a = Math.abs(weighted[i]); if (a > kPeak) kPeak = a;
  }
  if (kPeak < 0.0005) return { factor: 1.0, rms: 0, kPeak };

  // Loudness window: RMS over loudest 150ms — auditory integration time.
  const WINDOW_SEC = 0.15;
  const windowSamples = Math.floor(WINDOW_SEC * SR);
  const threshold = kPeak * ACTIVE_THRESHOLD_RATIO;
  let firstAudible = -1;
  for (let i = 0; i < weighted.length; i++) {
    if (Math.abs(weighted[i]) >= threshold) { firstAudible = i; break; }
  }
  let rms = kPeak, activeDuration = 0;
  if (firstAudible >= 0) {
    const winEnd = Math.min(weighted.length, firstAudible + windowSamples);
    let sumSq = 0, count = 0;
    for (let i = firstAudible; i < winEnd; i++) {
      sumSq += weighted[i] * weighted[i];
      count++;
    }
    rms = count > 0 ? Math.sqrt(sumSq / count) : kPeak;
    let lastAudible = firstAudible;
    for (let i = winEnd - 1; i >= firstAudible; i--) {
      if (Math.abs(weighted[i]) >= threshold) { lastAudible = i; break; }
    }
    activeDuration = (lastAudible - firstAudible) / SR;
  }
  const presetMult = PRESET_MULT[name] ?? 1.0;
  const target = TARGET_RMS * durationCompensation(activeDuration) * presetMult;

  let factor = rms > 0.0005 ? target / rms : 1.0;
  factor = Math.min(factor, (TARGET_PEAK * presetMult) / kPeak);
  factor = Math.min(FACTOR_MAX, factor);
  factor = Math.max(0.01, factor);
  return { factor, rms, kPeak };
}

function activeRms(buf) {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > peak) peak = a; }
  if (peak < 0.001) return 0;
  const t = peak * ACTIVE_THRESHOLD_RATIO;
  let s = 0, c = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]);
    if (a >= t) { s += buf[i] * buf[i]; c++; }
  }
  return c > 0 ? Math.sqrt(s / c) : 0;
}

const dB = (x) => x <= 1e-9 ? -Infinity : 20 * Math.log10(x);
const fmtDb = (x) => x === -Infinity ? "  -inf" : (x >= 0 ? "+" : "") + x.toFixed(1);

// ---- Driver ----

const path = new URL("../poc/defaults.acs", import.meta.url);
const src = stripComments(readFileSync(path, "utf8"));
const sounds = extractSoundBlocks(src);

const results = [];
for (const s of sounds) {
  const layers = parseLayers(s.body);
  if (!layers.length) continue;
  const out = zeros(N);
  layers.forEach((layer, i) => {
    const buf = renderLayer(layer, VOLUME, 12345 + i * 7);
    addWithOffset(out, buf, layer);
  });
  const { factor, rms: kRms } = measureCalibration(out, s.name);
  const cls = classify(s.name);
  const finalFactor = factor * (CLASS_MULT[cls] ?? 1.0);
  // Re-render at calibrated volume to confirm equal loudness post-factor.
  const cal = zeros(N);
  layers.forEach((layer, i) => {
    const buf = renderLayer(layer, VOLUME * finalFactor, 12345 + i * 7);
    addWithOffset(cal, buf, layer);
  });
  for (let i = 0; i < N; i++) cal[i] = Math.tanh(cal[i]);
  const postRms = activeRms(kWeight(cal));
  results.push({ name: s.name, cls, kRms, factor: finalFactor, postRms });
}

results.sort((a, b) => a.postRms - b.postRms);

console.log(`\nDefaults preset auto-calibration (K-weighted RMS, target=${TARGET_RMS})`);
console.log("─".repeat(82));
console.log(
  "preset".padEnd(20) +
  "class".padEnd(14) +
  "preRms".padStart(10) +
  "factor".padStart(9) +
  "postRms".padStart(10) +
  "post-dB".padStart(10) +
  "  flag"
);
console.log("─".repeat(82));
const TARGET_DB = dB(TARGET_RMS);
for (const r of results) {
  const deltaDb = dB(r.postRms) - TARGET_DB;
  let flag = "";
  if (Math.abs(deltaDb) > 6) flag = "OFF " + (deltaDb > 0 ? "↑" : "↓");
  else if (Math.abs(deltaDb) > 3) flag = "mild";
  console.log(
    r.name.padEnd(20) +
    r.cls.padEnd(14) +
    r.kRms.toFixed(4).padStart(10) +
    r.factor.toFixed(2).padStart(9) +
    r.postRms.toFixed(4).padStart(10) +
    fmtDb(dB(r.postRms)).padStart(10) +
    "  " + flag
  );
}
console.log("─".repeat(82));
const post = results.map(r => r.postRms).filter(x => x > 0);
const lo = Math.min(...post), hi = Math.max(...post);
console.log(`post-cal spread: ${(hi/lo).toFixed(2)}x  (${(dB(hi) - dB(lo)).toFixed(1)} dB)`);
console.log();

// Emit JS object literal for pasting into calibrate.js BAKED_FACTORS.
if (process.argv.includes("--bake")) {
  console.log("// Paste into BAKED_FACTORS in poc/runtime/calibrate.js:");
  const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name));
  for (const r of sorted) {
    const k = /^[a-z]+$/.test(r.name) ? r.name : `"${r.name}"`;
    console.log(`  ${k}: ${r.factor.toFixed(3)},`);
  }
  console.log();
}
