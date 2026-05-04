---
title: Mood — organic
impact: MEDIUM
impactDescription: Slow LFO on cutoff + mild detune. Adds breath and life.
tags: mood, organic, lfo
prompt: "organic breath alive natural soft"
example: |
  .nature-app { sound-mood: organic; }
  @sound my-tone { body { tones: 440hz, 660hz; decays: 0.5s, 0.35s; gain: 0.3; } }
---

## Mood — organic

The runtime overlay applies a 1–3 Hz LFO on the filter cutoff plus mild detune.
Result: sounds drift slightly in tone over their decay, reading as "alive".

Useful for:
- Ambient apps where steady UI sounds feel sterile.
- Wellness / meditation interfaces.
- Long-form events (modal-open, page-enter) where stillness feels artificial.

**Don't** apply to short ticks/clicks (< 50 ms decay) — the LFO doesn't have time to
move noticeably.

Reference: `poc/runtime/mood.js` → `MOODS.organic`.
