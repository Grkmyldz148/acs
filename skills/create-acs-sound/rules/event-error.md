---
title: Error — sawtooth + noise burst, descending pitch
impact: HIGH
impactDescription: Negative feedback. Must be unmistakable but not punishing.
tags: event, error, descending, dissonant
prompt: "error fail wrong invalid denied delete destroy"
example: |
  @sound my-error {
    body  { osc: sawtooth; freq: 440hz; pitch-from: 440hz to 220hz; decay: 250ms; gain: 0.25; }
    rasp  { noise: white; filter: bandpass; cutoff: 600hz; q: 4; decay: 180ms; gain: 0.15; }
  }
---

## Error — sawtooth + noise burst, descending pitch

A sawtooth carries the fundamental dissonance; a bandpass-filtered noise layer
adds the "rasp" that makes it read as wrong. The descending pitch sweep
(via `pitch-from`) is the universal "things going down" cue.

**Don't** make errors loud — `gain ≤ 0.4` total. Loud errors feel punishing,
which makes users avoid your app.

**Don't** add reverb to errors — the tail muddles the urgency.
Use `room: dry` (the default) or omit `room` entirely.

If the prompt says "soft error" or "polite warning", swap sawtooth for triangle
and drop the noise layer.

Reference: `poc/defaults.acs` → `@sound error`, `@sound denied`, `@sound buzz`.
