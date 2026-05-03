import { setOscType } from "./dsp.js";

/* presets.js — built-in preset functions.
 *
 * Most "rich" presets (bell, modal-y, percussive families) are now
 * defined declaratively in defaults.acs using the same @sound DSL
 * users have. This file only keeps presets that need procedural code
 * (per-trigger jitter, multi-stage scheduling, sample caching), which
 * the DSL doesn't yet express.
 *
 * Currently active procedural-only presets:
 *   - keystroke      (per-trigger frequency randomization)
 *   - old-bell       (kept for A/B comparison with the DSL bell)
 *
 * Other entries (tap, click, pop, chime, buzz, error, success,
 * carriage-return, bell) exist below as historical/legacy procedural
 * implementations but are SHADOWED by their DSL @sound counterparts
 * in defaults.acs (customPresets[name] takes precedence over presets[name]).
 * Kept here so that a stylesheet without defaults.acs still gets sound.
 */

let bellBuffer = null;
let bellBufferPromise = null;

// Per-ctx cache for the keystroke noise tick buffer. Re-randomizing on
// every keystroke at fast typing rates was creating ~16 buffers/sec —
// content is noise so the same buffer reused is indistinguishable.
// Keyed by (ctx, dur) so changes to dur produce correctly-sized buffers.
const keystrokeNoiseBufs = new WeakMap();
function getKeystrokeNoiseBuf(ctx, dur) {
  let perCtx = keystrokeNoiseBufs.get(ctx);
  if (!perCtx) { perCtx = new Map(); keystrokeNoiseBufs.set(ctx, perCtx); }
  const key = String(dur);
  let buf = perCtx.get(key);
  if (buf) return buf;
  const sr = ctx.sampleRate;
  buf = ctx.createBuffer(1, Math.max(1, Math.ceil(sr * dur)), sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) {
    ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.0);
  }
  perCtx.set(key, buf);
  return buf;
}

function renderModalBuffer(sr, { fundamental, ratios, decays, gains, duration }) {
  const offline = new OfflineAudioContext(1, Math.ceil(sr * duration), sr);
  const burstDur = 0.003;
  const burstBuf = offline.createBuffer(1, Math.ceil(sr * burstDur), sr);
  const bch = burstBuf.getChannelData(0);
  for (let i = 0; i < bch.length; i++) {
    bch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bch.length, 0.5);
  }
  const burst = offline.createBufferSource();
  burst.buffer = burstBuf;

  const shaper = offline.createWaveShaper();
  const cl = 1024;
  const curve = new Float32Array(cl);
  for (let i = 0; i < cl; i++) {
    const x = (i / (cl - 1)) * 2 - 1;
    curve[i] = x >= 0 ? Math.tanh(x * 1.2) : Math.tanh(x * 0.6) * 1.2;
  }
  shaper.curve = curve;
  burst.connect(shaper);

  ratios.forEach((ratio, i) => {
    const f = fundamental * ratio;
    const w = (2 * Math.PI * f) / sr;
    const r = Math.pow(0.001, 1 / (decays[i] * sr));
    const a1 = -2 * r * Math.cos(w);
    const a2 = r * r;
    try {
      const iir = offline.createIIRFilter([1, 0, -1], [1, a1, a2]);
      const g = offline.createGain();
      g.gain.value = gains[i];
      shaper.connect(iir).connect(g).connect(offline.destination);
    } catch (e) {
      const bp = offline.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 30;
      const g = offline.createGain();
      g.gain.value = gains[i];
      shaper.connect(bp).connect(g).connect(offline.destination);
    }
  });

  burst.start(0);
  burst.stop(burstDur);

  return offline.startRendering().then((buf) => {
    const ch = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
    if (peak > 0) {
      const scale = 0.85 / peak;
      for (let i = 0; i < ch.length; i++) ch[i] *= scale;
    }
    return buf;
  });
}

function ensureBellBuffer(ctx) {
  if (bellBuffer) return Promise.resolve(bellBuffer);
  if (bellBufferPromise) return bellBufferPromise;
  bellBufferPromise = renderModalBuffer(ctx.sampleRate, {
    fundamental: 880,
    ratios: [1.0, 1.483, 1.932, 2.546],
    decays: [0.9, 0.45, 0.25, 0.12],
    gains: [1.0, 0.55, 0.3, 0.18],
    duration: 1.5,
  }).then((buf) => {
    bellBuffer = buf;
    return buf;
  });
  return bellBufferPromise;
}

export const presets = {
  tap(ctx, { volume = 0.4, pitchMul = 1, dest }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 2000 * pitchMul;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.06);
  },

  click(ctx, { volume = 0.5, pitchMul = 1, dest }) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < ch.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      ch[i] = b0 + b1 + b2 + w * 0.1848;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1500 * pitchMul;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.08);
  },

  pop(ctx, { volume = 0.4, pitchMul = 1, dest }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(400 * pitchMul, t);
    osc.frequency.exponentialRampToValueAtTime(150 * pitchMul, t + 0.05);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);
  },

  chime(ctx, { volume = 0.45, pitchMul = 1, dest }) {
    const t = ctx.currentTime;
    const partials = [
      { f: 660, g: 1.0, d: 0.6 },
      { f: 990, g: 0.5, d: 0.3 },
    ];
    const m = ctx.createGain();
    m.gain.value = volume;
    m.connect(dest);
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = p.f * pitchMul;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p.g, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      osc.connect(g).connect(m);
      osc.start(t);
      osc.stop(t + p.d + 0.05);
    });
  },

  buzz(ctx, { volume = 0.35, pitchMul = 1, dest }) {
    const osc = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    setOscType(osc, ctx, "sawtooth");
    osc.frequency.value = 90 * pitchMul;
    f.type = "lowpass";
    f.frequency.value = 400;
    f.Q.value = 0.5;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(f).connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.25);
  },

  error(ctx, { volume = 0.4, pitchMul = 1, dest }) {
    const t = ctx.currentTime;
    [0, 0.12].forEach((off) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      setOscType(osc, ctx, "square");
      osc.frequency.value = 220 * pitchMul;
      const s = t + off;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(volume, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      osc.connect(g).connect(dest);
      osc.start(s);
      osc.stop(s + 0.1);
    });
  },

  success(ctx, { volume = 0.45, pitchMul = 1, dest }) {
    const t = ctx.currentTime;
    [{ f: 660, off: 0 }, { f: 990, off: 0.08 }].forEach(({ f, off }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f * pitchMul;
      const s = t + off;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(volume, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35);
      osc.connect(g).connect(dest);
      osc.start(s);
      osc.stop(s + 0.4);
    });
  },

  // Typewriter keystroke — landing/audio-engine.js style: a high sine
  // (1800-2600 Hz, randomized per trigger so rapid input doesn't sound
  // robotic) plus a brief highpass noise tick. Earlier version had a
  // 100 Hz sub-bass body that thumped on small speakers — removed for
  // a lighter, "tickly" character matching the landing demo.
  keystroke(ctx, { volume = 0.6, pitchMul = 1, dest }) {
    const t = ctx.currentTime;
    const sr = ctx.sampleRate;
    const f = (1800 + Math.random() * 800) * pitchMul;

    // tone
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(volume * 0.36, t + 0.001);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    osc.connect(og).connect(dest);
    osc.start(t);
    osc.stop(t + 0.05);

    // noise tick — buffer cached per ctx (noise content can be reused;
    // only the BufferSource node needs to be fresh each trigger).
    const nd = 0.01;
    const buf = getKeystrokeNoiseBuf(ctx, nd);
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 4000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(volume * 0.16, t + 0.0005);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    ns.connect(nf).connect(ng).connect(dest);
    ns.start(t);
    ns.stop(t + nd);
  },

  "carriage-return"(ctx, { volume = 0.45, pitchMul = 1, dest }) {
    const t = ctx.currentTime;
    const partials = [
      { f: 2400, g: 1.00, d: 0.8 },
      { f: 3600, g: 0.50, d: 0.4 },
      { f: 5400, g: 0.20, d: 0.2 },
    ];
    const m = ctx.createGain();
    m.gain.value = volume;
    m.connect(dest);
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = p.f * pitchMul;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p.g, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      osc.connect(g).connect(m);
      osc.start(t);
      osc.stop(t + p.d + 0.05);
    });
  },

  // Old bell — 3-sine sum, kept for A/B comparison with modal version.
  "old-bell"(ctx, { volume = 0.5, pitchMul = 1, dest }) {
    const t = ctx.currentTime;
    const partials = [
      { f: 880,  g: 1.00, d: 1.20 },
      { f: 1320, g: 0.40, d: 0.40 },
      { f: 2640, g: 0.15, d: 0.18 },
    ];
    const m = ctx.createGain();
    m.gain.value = volume;
    m.connect(dest);
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = p.f * pitchMul;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p.g, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
      osc.connect(g).connect(m);
      osc.start(t);
      osc.stop(t + p.d + 0.05);
    });
  },

  // Modal bell — pre-rendered + normalized buffer playback.
  bell(ctx, { volume = 0.5, pitchMul = 1, dest }) {
    // Capture trigger time immediately. If the buffer isn't cached yet
    // we'd otherwise schedule playback at the (delayed) promise-resolve
    // moment, perceptibly behind the click.
    const triggerTime = ctx.currentTime;
    ensureBellBuffer(ctx).then((buffer) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = pitchMul;
      const g = ctx.createGain();
      g.gain.value = volume * 1.8;
      src.connect(g).connect(dest);
      // If render took longer than user gesture latency tolerance, just
      // start now — better late than skipped. Otherwise honor original time.
      src.start(Math.max(triggerTime, ctx.currentTime));
    });
  },
};
