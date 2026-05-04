---
title: Notification — bell-like ding, friendly attention
impact: HIGH
impactDescription: Should attract attention without urgency. Most-overused UI sound; get it right.
tags: event, notification, bell, alert
prompt: "notification alert ding bell mention badge incoming"
example: |
  @sound my-notify {
    body { tones: 880hz, 1320hz; decays: 0.5s, 0.35s; gain: 0.32; }
    ping { osc: sine; freq: 1760hz; start: 60ms; decay: 0.25s; gain: 0.18; }
  }
---

## Notification — bell-like ding, friendly attention

A bell archetype: a body of two harmonically-related sines (root + perfect fifth)
plus a higher modal "ping" that gives the sound a clear ring. Decays are layered
so the upper partials die first — exactly how a real bell behaves.

**Don't** use `osc: square` or `osc: sawtooth` for notifications — they read as
electronic alerts (think old phone-system).

**Do** keep total gain under 0.5 — notifications should be friendly, not alarming.
For higher-priority alerts, layer in a third tone (1.32 kHz × 1.5 = 1.98 kHz) rather than
boosting gain.

If the prompt says "subtle notification" or "quiet ping", drop to a single layer
(`@sound ping` from defaults).

Reference: `poc/defaults.acs` → `@sound notify`, `@sound mention`, `@sound badge`, `@sound chime`.
