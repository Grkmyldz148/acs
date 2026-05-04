---
title: Complete — three-note ascending phrase
impact: MEDIUM-HIGH
impactDescription: Long-form success; used for "level up", "unlock", "achievement".
tags: event, complete, chord, ascending
prompt: "complete unlock achievement level-up confetti finished"
example: |
  @sound my-complete {
    n1 { tones: 660hz;  decay: 200ms; gain: 0.25; }
    n2 { tones: 880hz;  start: 90ms;  decay: 220ms; gain: 0.25; }
    n3 { tones: 1320hz; start: 180ms; decay: 280ms; gain: 0.25; }
  }
---

## Complete — three-note ascending phrase

Three sequential notes spell out a clear ascent. Differ from `event-success`
by being a melodic *phrase* rather than a chord — three discrete tones with
larger `start` offsets (~80–100 ms apart) so the user perceives them as
a sequence, not simultaneity.

**Don't** stack more than 3 notes — past that the user perceives a tune,
which is too prescriptive for a UI sound.

**Do** keep total duration under 600 ms (last `start` + last `decay`),
or the sound starts blocking interaction.

Reference: `poc/defaults.acs` → `@sound complete`.
