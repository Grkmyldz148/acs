---
title: Mood — glassy
impact: MEDIUM-HIGH
impactDescription: A resonant peak around 4–6 kHz gives sounds a "glass-tap" character.
tags: mood, glassy, resonance
prompt: "glassy crystal glass icy"
example: |
  @sound my-glass-tap {
    body { tones: 2400hz, 4800hz; decays: 0.3s, 0.18s; gain: 0.3; }
  }
  /* Or runtime overlay: */
  .lab-tools { sound-mood: glassy; sound-mood-mix: 0.5; }
---

## Mood — glassy

Two ingredients: high fundamentals (2–3 kHz minimum), and a resonant peak around 4.5 kHz.
The runtime `sound-mood: glassy` adds the peak via a peaking filter; baked into the `@sound`,
you achieve the same with a second tone an octave above the fundamental.

**Use sound-mood-mix** to dial it in: 1.0 = full glassy, 0.4 = subtle hint.
For UI ticks/clicks, 0.3–0.5 mix is plenty.

Reference: `poc/runtime/mood.js` → `MOODS.glassy`.
