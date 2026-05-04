---
title: Effect — bitcrush for lofi
impact: MEDIUM
impactDescription: Sample-rate reduction approximation. Bake lightly via detune+distortion.
tags: effect, bitcrush, lofi, retro
prompt: "bitcrush lofi crushed retro 8-bit"
example: |
  /* Best as runtime overlay — true bitcrush isn't a per-layer DSL key: */
  .game-ui { sound-mood: lofi; sound-mood-mix: 0.6; }

  /* Manual approximation if you need it baked into one preset: */
  @sound my-crushed {
    body {
      osc: square;            /* square inherently has more aliasing-friendly harmonics */
      freq: 880hz;
      detune: 5;              /* slight pitch instability */
      drive: 0.4;             /* harmonic distortion approximates quantization */
      filter: lowpass; cutoff: 4000hz;
      decay: 100ms;
      gain: 0.3;
    }
  }
---

## Effect — bitcrush for lofi

True bitcrushing — sample-rate and bit-depth reduction — isn't expressible as a
per-layer DSL key in current ACS. The runtime applies it as part of the `lofi`
mood overlay (see `mood-lofi`). For one-off baking, approximate it with
**`drive` + `osc: square`**, which reproduces the harmonic intermodulation
characteristic of low-bit-depth audio.

#### Recipe (baked approximation)

| Ingredient            | Why                                           |
| --------------------- | --------------------------------------------- |
| `osc: square`         | Square's odd harmonics survive crushing well  |
| `drive: 0.3..0.6`     | Saturation mimics quantization distortion     |
| `detune: 3..10`       | Pitch instability ≈ low-rate clock jitter     |
| `filter: lowpass`     | Cutoff at ~3–4 kHz mimics anti-alias filter   |

The runtime overlay (`sound-mood: lofi`) does this properly with sample-rate
reduction; prefer it when the user wants a global vibe.

#### When to use the baked recipe

- A *single* preset needs the lofi vibe but the rest of the UI shouldn't.
- You're authoring a one-off `@sound` for a retro-themed component.
- The user explicitly requested "make THIS sound lofi" (not "make the app lofi").

#### Anti-patterns

- Stacking baked bitcrush on top of `sound-mood: lofi` — double application
  produces unintelligible mush.
- Using bitcrush with delicate `tones:` chords — chord clarity dies under heavy crush.

Reference: `poc/runtime/mood.js` → `MOODS.lofi`.
