/* mood.js — orthogonal "mood" transformations applied at trigger time.
 *
 * Per SOUND_DESIGN.md: a CSS-cascade-friendly modifier on top of any
 * preset. e.g. `body { sound-mood: warm; }` makes ALL sounds in the
 * subtree feel warm, without re-defining each preset.
 *
 * Implementation: at trigger time, insert a filter chain between the
 * preset's output and the destination. Returns the new dest node the
 * preset should connect to.
 */

/* Mood filter chains. Values are deliberately cranked — each mood
 * needs to be unmistakable in a side-by-side A/B test, otherwise the
 * "sound-mood is a real overlay" pitch falls flat. The numbers below
 * are tuned for the bell/chime/notify family which carries enough
 * harmonic content for the filters to bite into; for ultra-percussive
 * sources (tap, click) the perceived shift is naturally smaller. */
const moodConfigs = {
  warm: {
    // Hard roll-off + obvious tape-style saturation.
    filters: [
      { type: "lowpass", freq: 1700, q: 0.7 },
      { type: "highshelf", freq: 5000, q: 0.7, gain: -8 },
    ],
    saturation: 0.4,
  },
  bright: {
    // Aggressive high-shelf lift + sub kill so the highs really sing.
    filters: [
      { type: "highshelf", freq: 3200, q: 0.7, gain: 12 },
      { type: "highpass",  freq: 200,  q: 0.5 },
    ],
  },
  glassy: {
    // Sharp resonant peak in the bell-strike band, plus an air-band lift.
    filters: [
      { type: "peaking",   freq: 5500, q: 4.5, gain: 14 },
      { type: "highshelf", freq: 8000, q: 0.7, gain: 6 },
      { type: "highpass",  freq: 350,  q: 0.5 },
    ],
  },
  metallic: {
    // Ring-modulation injects inharmonic sidebands a bell + filter
    // chain alone can't produce — that's what makes a tone read as
    // "metallic clang" vs "wooden tap". Modulator at 287 Hz, 60 %
    // wet so the original tone stays recognizable underneath.
    filters: [
      { type: "peaking", freq: 2200, q: 5.0, gain: 10 },
      { type: "peaking", freq: 4400, q: 5.0, gain: 8 },
      { type: "highpass", freq: 400,  q: 0.5 },
    ],
    saturation: 0.2,
    ringmod: { freq: 287, mix: 0.6 },
  },
  organic: {
    // Smooth roll-off + warm saturation; opposite of metallic.
    filters: [
      { type: "lowpass",  freq: 3500, q: 0.5 },
      { type: "peaking",  freq: 800,  q: 1.2, gain: 4 },
    ],
    saturation: 0.45,
  },
  punchy: {
    // Mid-bump + drive — feels compressed and present.
    filters: [
      { type: "peaking", freq: 1400, q: 1.8, gain: 8 },
      { type: "highshelf", freq: 6000, q: 0.7, gain: 3 },
    ],
    saturation: 0.6,
  },
  retro: {
    // Telephone-grade bandpass + heavy clip + 4-bit bitcrush. The
    // bitcrush is what makes this read as "8-bit/Game Boy" rather
    // than just "small speaker" — quantization adds a buzzy stair-
    // step character that EQ alone cannot mimic.
    filters: [
      { type: "highpass", freq: 600,  q: 1.0 },
      { type: "lowpass",  freq: 2200, q: 1.5 },
      { type: "peaking",  freq: 1100, q: 1.5, gain: 6 },
    ],
    saturation: 0.65,
    bitcrush: { bits: 4 },
  },
  airy: {
    // Roll off the body, leave the air — opposite of warm.
    filters: [
      { type: "highpass",  freq: 1500, q: 0.6 },
      { type: "highshelf", freq: 6000, q: 0.7, gain: 6 },
    ],
  },
  lofi: {
    // Cassette-tape muffle: hard lowpass + heavy saturation + mid lift
    // for the broken-speaker honk + a constant noise bed for tape
    // hiss. The noise floor is the give-away — it's audible even in
    // the silences between trigger taps, immediately reading as
    // "old recording medium" rather than "filtered modern sound".
    filters: [
      { type: "lowpass",  freq: 1100, q: 0.7 },
      { type: "highpass", freq: 280,  q: 0.5 },
      { type: "peaking",  freq: 900,  q: 1.5, gain: 5 },
    ],
    saturation: 0.7,
    bitcrush: { bits: 7 },
    noise: { color: "pink", level: 0.025, cutoff: 4500 },
  },
};

// Cache mood overlay graphs per (ctx, moodName, finalDest) tuple. Without
// this, every trigger built fresh BiquadFilter + WaveShaper nodes — a
// rapid-typing user with mood active was creating ~50/sec, tiny but
// pointless allocation. WeakMap keys hold ctx + dest references so they
// auto-release when the audio graph is torn down.
const moodCache = new WeakMap(); // ctx → Map<moodName, WeakMap<dest, inputGain>>

// ── Curve generators ──────────────────────────────────────────
// Quantizer curve for bitcrush. `bits` is the resolution; lower bits =
// fewer audible levels = stair-step distortion. 4 bits ≈ NES, 6-8 ≈
// vintage sampler grit. Caller wraps this in a WaveShaper.
function bitcrushCurve(bits) {
  const cl = 4096;
  const out = new Float32Array(cl);
  const levels = Math.max(2, Math.pow(2, bits));
  const step = 2 / (levels - 1);
  for (let i = 0; i < cl; i++) {
    const x = (i / (cl - 1)) * 2 - 1;
    out[i] = Math.round(x / step) * step;
  }
  return out;
}

// Tanh saturation. Higher drive = harder clipping.
function saturationCurve(drive) {
  const cl = 1024;
  const out = new Float32Array(cl);
  for (let i = 0; i < cl; i++) {
    const x = (i / (cl - 1)) * 2 - 1;
    out[i] = Math.tanh(x * (1 + drive * 3));
  }
  return out;
}

// Build the filter / saturation / bitcrush / ring-mod chain for a
// mood. Returns {input, output}. Order matters — filters first
// (shape spectrum), then saturation (harmonic distortion in shaped
// band), then bitcrush (quantize after harmonics exist), then ring-
// mod (multiply against a sine to sprout inharmonic sidebands).
function buildMoodChain(ctx, cfg) {
  const input = ctx.createGain();
  let tail = input;

  for (const f of cfg.filters || []) {
    const node = ctx.createBiquadFilter();
    node.type = f.type;
    node.frequency.value = f.freq;
    if (typeof f.q === "number") node.Q.value = f.q;
    if (typeof f.gain === "number") node.gain.value = f.gain;
    tail.connect(node);
    tail = node;
  }

  if (cfg.saturation && cfg.saturation > 0) {
    const ws = ctx.createWaveShaper();
    ws.curve = saturationCurve(cfg.saturation);
    tail.connect(ws);
    tail = ws;
  }

  if (cfg.bitcrush) {
    const ws = ctx.createWaveShaper();
    ws.curve = bitcrushCurve(cfg.bitcrush.bits ?? 5);
    ws.oversample = "none";        // we WANT the aliasing artefacts
    tail.connect(ws);
    tail = ws;
  }

  // Ring-modulation: multiply incoming signal by a sine at `freq`.
  // Implementation: a GainNode whose `gain` AudioParam is at 0 by
  // default, then driven audio-rate from an OscillatorNode. Since
  // the output gain follows the modulator (-1..+1 range), the
  // result is input × sin(2π·freq·t). The dry/wet balance is
  // baked via the `mix` knob — fully wet ring-mod sounds alien;
  // 0.4 mix keeps the original tone audible underneath.
  if (cfg.ringmod) {
    const { freq = 230, mix = 0.5 } = cfg.ringmod;
    const dry  = ctx.createGain();
    const wet  = ctx.createGain();
    wet.gain.value = 0;            // multiplied audio-rate by osc
    dry.gain.value = 1 - mix;
    wet.gain.value = mix;          // gets re-wrapped by osc connection below
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(wet.gain);         // audio-rate modulation: gain = 0 + osc(t)
    osc.start();
    const sum = ctx.createGain();
    tail.connect(dry).connect(sum);
    tail.connect(wet).connect(sum);
    tail = sum;
  }

  // Optional pre-summed noise bed (cassette / vinyl hiss). Implemented
  // as a once-built filtered-noise buffer source looping at low gain.
  // The buffer is reused across triggers via cache (no per-trigger
  // allocation thanks to the cache wrapping applyMood).
  if (cfg.noise) {
    const { color = "pink", level = 0.05 } = cfg.noise;
    const buf = makeNoiseBuffer(ctx, color, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cfg.noise.cutoff ?? 6000;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(lp).connect(g);
    src.start();
    // Sum noise into the same tail so signal + bed reach the output
    // together. Branch a fresh sum node to avoid backwiring the chain.
    const sum = ctx.createGain();
    tail.connect(sum);
    g.connect(sum);
    tail = sum;
  }

  return { input, output: tail };
}

// Cache one noise buffer per (ctx, color, length) — generating these
// is cheap but doing it on every trigger would still add jitter.
const noiseBufferCache = new WeakMap();
function makeNoiseBuffer(ctx, color, seconds) {
  let perCtx = noiseBufferCache.get(ctx);
  if (!perCtx) { perCtx = new Map(); noiseBufferCache.set(ctx, perCtx); }
  const key = `${color}:${seconds}`;
  if (perCtx.has(key)) return perCtx.get(key);
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (color === "pink") {
    // Voss-McCartney algorithm — passable pink noise with low cost.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  perCtx.set(key, buf);
  return buf;
}

// `mix` ∈ [0, 1]:
//   1 (default) — full mood applied (back-compat)
//   0           — bypass (no-op, returns finalDest directly)
//   0..1        — wet/dry blend: dry goes straight to finalDest at
//                 (1-mix), wet goes through filter+saturation at (mix).
//
// The mix=1 path is cached per (ctx, mood, dest) — that's the hot path
// for static stylesheets. Non-default mix builds a fresh graph each call
// so concurrent triggers with different mixes don't race on cached gains.
export function applyMood(ctx, moodName, finalDest, mix = 1) {
  if (!moodName || !moodConfigs[moodName]) return finalDest;
  if (mix <= 0) return finalDest;
  const m = Math.min(1, mix);

  if (m === 1) {
    let perCtx = moodCache.get(ctx);
    if (!perCtx) { perCtx = new Map(); moodCache.set(ctx, perCtx); }
    let perMood = perCtx.get(moodName);
    if (!perMood) { perMood = new WeakMap(); perCtx.set(moodName, perMood); }
    const cached = perMood.get(finalDest);
    if (cached) return cached;
    const { input, output } = buildMoodChain(ctx, moodConfigs[moodName]);
    output.connect(finalDest);
    perMood.set(finalDest, input);
    return input;
  }

  // Wet/dry blend graph. Caller's preset connects to `entry`; entry forks
  // into a dry path (gain = 1-m) and a wet path through the mood chain
  // (gain = m), both summing into finalDest.
  const entry = ctx.createGain();
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - m;
  entry.connect(dryGain).connect(finalDest);
  const { input: wetIn, output: wetOut } = buildMoodChain(ctx, moodConfigs[moodName]);
  const wetGain = ctx.createGain();
  wetGain.gain.value = m;
  entry.connect(wetIn);
  wetOut.connect(wetGain).connect(finalDest);
  return entry;
}

export const moodNames = Object.keys(moodConfigs);
