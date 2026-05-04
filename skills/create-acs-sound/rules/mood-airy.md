---
title: Mood — airy
impact: MEDIUM
impactDescription: Subtle high-shelf + reverb send. Adds space.
tags: mood, airy, reverb, space
prompt: "airy spacious open soft ethereal"
example: |
  .calm-app { sound-mood: airy; sound-mood-mix: 0.4; }
  /* Or pair with a room: */
  dialog[open] { sound-mood: airy; room: medium-room; }
---

## Mood — airy

Two ingredients:
- High-shelf boost (subtle — 1–2 dB at 6 kHz).
- A small reverb send blended with the dry signal.

Best used in combination with a `room` setting at the element level — the mood
adds the high-shelf shimmer; the room adds the spatial reflections.

Often paired with `sound-mood-mix: 0.3..0.5` so the airiness is a hint, not a wash.

Reference: `poc/runtime/mood.js` → `MOODS.airy`.
