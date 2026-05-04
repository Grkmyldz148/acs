---
title: Mood — bright
impact: HIGH
impactDescription: Inverse of warm. Adds high-shelf, removes any lowpass that might be present.
tags: mood, brightness, highshelf
prompt: "bright brighter crisp shiny sparkle"
example: |
  @sound my-bright-tap {
    body { osc: triangle; freq: 1800hz; decay: 60ms; gain: 0.3; }
    /* No filter — bright sounds want all the high content */
  }
  /* OR */
  .bright-zone { sound-mood: bright; }
---

## Mood — bright

Subtract any existing lowpass; if no filter, leave none. Optionally add a triangle
or square waveform (richer in odd harmonics) and shift the fundamental up by 200–400 Hz.

The runtime `sound-mood: bright` adds a high-shelf boost and (mildly) lifts spectral
centroid — both move the perceived energy upward without changing the perceived note.

**Conflict with warm**: `bright` overrides `warm` if both adjectives appear (later wins).

Reference: `poc/runtime/mood.js` → `MOODS.bright`.
