---
title: Tick — single high-frequency sine, micro decay
impact: HIGH
impactDescription: Background micro-feedback for hover, focus, scroll, snap.
tags: event, tick, micro
prompt: "tick scroll snap focus hover"
example: |
  @sound my-tick {
    body { osc: sine; freq: 2400hz; decay: 6ms; gain: 0.12; }
  }
---

## Tick — single high-frequency sine, micro decay

A `tick` should be barely-there — high-frequency, very short decay, low gain.
It's the sound a hover/focus/scroll-snap should make: the user feels it more than hears it.

**Don't** use modal or noise sources for ticks — they're too loud at any reasonable gain.
**Do** keep gain ≤ 0.15 and decay ≤ 10 ms. Anything longer becomes a click.

If the prompt says "soft tick" or "subtle tick", lower frequency to ~1.6 kHz and gain to 0.08.

Reference: `poc/defaults.acs` → `@sound tick`.
