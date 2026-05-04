---
title: Tap — body + click pair, tactile feel
impact: HIGH
impactDescription: The "satisfying tap" — body gives identity, click gives the snap.
tags: event, tap, click+body
prompt: "tap touch press button"
example: |
  @sound my-tap {
    body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
    click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
  }
---

## Tap — body + click pair, tactile feel

A tap differs from a click by being slightly longer and having a layered transient.
The `body` carries the pitched character; the `click` adds the high-frequency
snap that tells the ear "I just touched something".

**Use it when** the prompt says "tap", "press", "tactile", "responsive button".

**Don't** add reverb to a tap — the short decay makes any tail muddy.
If the sound needs to feel "in a room", add `room: small-room` at the cascade
level instead of inside the `@sound`.

Reference: `poc/defaults.acs` → `@sound tap`, `@sound tap-tactile`.
