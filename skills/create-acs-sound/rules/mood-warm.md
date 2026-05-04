---
title: Mood — warm
impact: HIGH
impactDescription: Most-requested adjective. Adds lowpass, removes brittleness.
tags: mood, warmth, lowpass
prompt: "warm warmer mellow soft cozy"
example: |
  /* Bake into @sound: */
  @sound my-warm-bell {
    body { tones: 660hz, 990hz; decays: 0.6s, 0.4s;
           filter: lowpass; cutoff: 2500hz; gain: 0.4; }
  }
  /* OR apply at element: */
  .warm-app { sound-mood: warm; }
---

## Mood — warm

Two paths:

1. **Bake into the @sound** — add `filter: lowpass; cutoff: 2200..2800hz` to the
   body layer. Use this when the prompt says "make me a warm X".
2. **Cascade overlay** — `.scope { sound-mood: warm; }` applies the runtime warm
   filter to all sounds triggered inside that scope. Use this when the prompt
   describes a global UI vibe ("warm app").

Cutoff frequency: 2500 Hz is the sweet spot. Below 1.5 kHz → muffled. Above 4 kHz → no audible change.

Reference: `poc/runtime/mood.js` → `MOODS.warm`.
