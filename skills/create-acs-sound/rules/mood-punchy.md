---
title: Mood — punchy
impact: HIGH
impactDescription: Transient enhancer + tight gate. Makes sounds feel "tight".
tags: mood, punchy, envelope
prompt: "punchy tight snappy crisp punchier"
example: |
  /* Bake as envelope shape: */
  @sound my-punchy-tap {
    body { tones: 1.4khz; attack: 0; decay: 35ms; gain: 0.4; }
  }
  /* Or overlay: */
  .actions { sound-mood: punchy; }
---

## Mood — punchy

Punchy is fundamentally an envelope thing:
- `attack: 0` — instantaneous onset.
- `decay ≤ 60 ms` — short tail, no lingering.
- `gain` slightly hot (0.35–0.5) — the transient peak is what carries the punch.

The runtime overlay also adds a transient enhancer on the master bus, but baking
the envelope correctly is 80% of the work.

**Don't** stack punchy on already-short sounds — diminishing returns past `decay: 30 ms`.

Reference: `poc/runtime/mood.js` → `MOODS.punchy`.
