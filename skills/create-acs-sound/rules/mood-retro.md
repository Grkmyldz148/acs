---
title: Mood — retro
impact: MEDIUM
impactDescription: Bandpass + bitcrush. 8-bit / arcade aesthetic.
tags: mood, retro, bitcrush, arcade
prompt: "retro 8-bit arcade chiptune vintage"
example: |
  .game { sound-mood: retro; }
  @sound my-blip { body { osc: square; freq: 880hz; decay: 80ms; gain: 0.3; } }
---

## Mood — retro

The runtime overlay does:
- Bandpass filter at 800–2000 Hz (cuts the deep bass and crystal highs).
- Bitcrush (sample rate reduction to ~8 kHz, 8-bit quantization).

To bake it into the `@sound` itself, use `osc: square` with no filter and let the
runtime's natural quantization do most of the work.

**Pair with** `poc/themes/retro.acs` for a full retro UI aesthetic.

**Don't** apply retro to a `success`/`complete` chord — the bitcrush makes the
chord sound dissonant rather than triumphant.

Reference: `poc/runtime/mood.js` → `MOODS.retro`.
