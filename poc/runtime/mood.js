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

const moodConfigs = {
  warm: {
    // Roll off highs, slight saturation.
    filters: [{ type: "lowpass", freq: 2800, q: 0.7 }],
    saturation: 0.15,
  },
  bright: {
    // High-shelf boost, gentle.
    filters: [{ type: "highshelf", freq: 4000, q: 0.7, gain: 4 }],
  },
  glassy: {
    // Pre-resonant peak in 3-5 kHz range.
    filters: [{ type: "peaking", freq: 4000, q: 1.5, gain: 5 }],
  },
  metallic: {
    // Sharper highs, presence boost.
    filters: [
      { type: "peaking", freq: 3500, q: 2.0, gain: 6 },
      { type: "highshelf", freq: 6000, q: 0.7, gain: 3 },
    ],
  },
  organic: {
    // Tame sharp transients with slight LP + soft saturation.
    filters: [{ type: "lowpass", freq: 6000, q: 0.5 }],
    saturation: 0.25,
  },
  punchy: {
    // Mid presence + soft compression simulated via saturation.
    filters: [{ type: "peaking", freq: 1200, q: 1.2, gain: 3 }],
    saturation: 0.3,
  },
  retro: {
    // Tight bandpass + soft clip — 8-bit-ish.
    filters: [
      { type: "lowpass", freq: 1500, q: 0.8 },
      { type: "highpass", freq: 200, q: 0.5 },
    ],
    saturation: 0.4,
  },
  airy: {
    // High-pass, opens up.
    filters: [{ type: "highpass", freq: 800, q: 0.5 }],
  },
  lofi: {
    // Lowpass, slight saturation, slight noise mix would need an
    // additional noise generator (skipped for now — passive mood).
    filters: [{ type: "lowpass", freq: 2200, q: 0.6 }],
    saturation: 0.2,
  },
};

// Cache mood overlay graphs per (ctx, moodName, finalDest) tuple. Without
// this, every trigger built fresh BiquadFilter + WaveShaper nodes — a
// rapid-typing user with mood active was creating ~50/sec, tiny but
// pointless allocation. WeakMap keys hold ctx + dest references so they
// auto-release when the audio graph is torn down.
const moodCache = new WeakMap(); // ctx → Map<moodName, WeakMap<dest, inputGain>>

// Build the filter+saturation chain for a mood. Returns {input, output}.
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
    const cl = 1024;
    const c = new Float32Array(cl);
    const drive = cfg.saturation;
    for (let i = 0; i < cl; i++) {
      const x = (i / (cl - 1)) * 2 - 1;
      c[i] = Math.tanh(x * (1 + drive * 3));
    }
    ws.curve = c;
    tail.connect(ws);
    tail = ws;
  }
  return { input, output: tail };
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
