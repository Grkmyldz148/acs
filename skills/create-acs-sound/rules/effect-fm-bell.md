---
title: Effect — FM for bell-like body
impact: MEDIUM-HIGH
impactDescription: A small amount of FM on a sine produces tasteful inharmonic body.
tags: effect, fm, bell, modulation
prompt: "bell metallic chime fm modulation"
example: |
  @sound my-fm-bell {
    body {
      osc: sine;
      freq: 880hz;
      fm: { ratio: 1.5, depth: 80 };    /* subtle inharmonic shimmer */
      decay: 0.5s;
      gain: 0.32;
    }
  }
---

## Effect — FM for bell-like body

A small amount of frequency modulation on a sine carrier produces inharmonic
sidebands — the spectral signature of a bell. Without FM, a sine sounds pure
but lifeless. With too much FM, it sounds metallic or pinched.

#### Two parameters

```
fm: { ratio: <r>, depth: <d> }
```

- **ratio** — modulator frequency divided by carrier frequency.
  - `0.5` = sub-octave modulator, adds dark body.
  - `1` = unison, slight phase distortion.
  - `1.5` = perfect fifth above, classic bell.
  - `2` = octave above, brighter bell.
  - `2.76` = inharmonic ratio (Chowning's classic), most bell-like.
- **depth** — modulation index (Hz). Roughly 30–150 for tasteful FM.
  - `< 30` = barely audible inharmonicity.
  - `60–100` = clear bell character.
  - `> 200` = metallic/digital, often unwanted.

#### Sine vs other waveforms

FM is most predictable on **sine carriers** because there are no existing
harmonics to interfere with the sidebands. Triangle, square, and sawtooth
respond to FM but the result is harder to predict.

#### When to use FM

- The agent is trying to make a bell or chime and wants more character than
  pure tones provide.
- A click is too pure-sine for the desired vibe — adding light FM
  (`{ ratio: 0.5, depth: 60 }`) gives it perceived "weight" without changing
  the perceived pitch.
- The user explicitly asks for "inharmonic", "bell-like", "metallic".

#### When NOT to use FM

- High-velocity events (success chord, complete) — FM sidebands accumulate
  across multiple layers and turn into mud.
- Noise sources — FM has no defined behavior on noise (the runtime ignores it).

Reference: `poc/runtime/dsp.js` → `playOscLayer()` FM branch.
