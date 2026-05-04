---
title: Mood — metallic
impact: MEDIUM
impactDescription: Comb filtering at audible delays produces "robot/pipe" character.
tags: mood, metallic, comb
prompt: "metallic robot pipe industrial"
example: |
  /* Best as runtime overlay — the comb filter is hard to bake into @sound: */
  .industrial { sound-mood: metallic; }
  @sound my-base { body { osc: triangle; freq: 880hz; decay: 0.4s; gain: 0.3; } }
---

## Mood — metallic

The signature is comb filtering at audible delays (~3–8 ms), which creates a series of
notches/peaks in the spectrum that the ear reads as "metallic". This is hard to express
purely in DSL — prefer the runtime overlay (`sound-mood: metallic`).

If you must bake it: layer two copies of the body with a 5 ms `start` offset and slight
detune (5–10 cents) — the constructive/destructive interference approximates a comb.

**Don't** use metallic on bright bell sounds — they already have inharmonic energy
and stacking metallic on top yields harsh.

Reference: `poc/runtime/mood.js` → `MOODS.metallic`.
