---
title: Swoosh — filtered noise sweep
impact: MEDIUM
impactDescription: Page transitions, slide-ins, drawers. Texture, not pitch.
tags: event, swoosh, transition, noise
prompt: "swoosh slide transition page tab whoosh"
example: |
  @sound my-swoosh {
    body {
      noise: white;
      filter: bandpass; cutoff: 1500hz; q: 1.5;
      pitch-from: 800hz to 3000hz;
      decay: 250ms;
      gain: 0.35;
    }
  }
---

## Swoosh — filtered noise sweep

A swoosh is a noise burst whose filter cutoff *sweeps* — the agent's job is to
animate the bandpass center frequency from low to high (or vice versa).

`pitch-from` on a noise layer with a bandpass filter shifts the audible band,
producing the "whoosh" effect. Wider sweeps (200 Hz → 5 kHz) feel cinematic;
narrower (1 kHz → 3 kHz) feel like UI page transitions.

**Don't** add tones to a swoosh — it should be texture, not pitch.

**Do** vary `q`: 1.5 = wide (more breath), 4 = narrow (more "laser").

Reference: `poc/defaults.acs` → `@sound swoosh`, `@sound whoosh`.
