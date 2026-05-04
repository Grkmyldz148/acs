---
title: Layer — click + body pair
impact: HIGH
impactDescription: The "satisfying button" archetype. Body gives identity; click gives the snap.
tags: layer, click+body, transient
prompt: "tap satisfying tactile button responsive press"
example: |
  @sound my-tap {
    body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
    click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
  }
---

## Layer — click + body pair

The most-used multi-layer shape in ACS. Two layers fire simultaneously:

- **`body`** carries the *pitched* identity — what makes the sound recognizable
  as belonging to your UI vocabulary.
- **`click`** is a high-frequency noise burst with very short decay (5–15 ms) —
  it gives the sound the high-frequency "edge" that the ear reads as
  "I touched something solid".

#### Tuning the click layer

```
noise: white                /* white = bright "thwack"; pink = softer "thunk" */
filter: highpass             /* Always highpass — keeps it from muddying the body */
cutoff: 3000..6000hz         /* Higher = more "snap"; lower = more "thump"      */
decay: 5..15ms               /* Past 20 ms it stops feeling like a click        */
gain: 0.2..0.35              /* Generally lower than body's gain                */
```

#### Anti-patterns

- **Click layer with `osc` source**: technically works but defeats the purpose;
  noise layers couple better with the body's tonal core.
- **Same decay on both layers**: when both layers decay over the same window,
  the click loses its punch. Click should always decay much faster.
- **Click layer dominates body**: if `click.gain > body.gain`, the sound feels
  hollow. Body should always carry more energy than click.

#### When to use

Almost always — except for `event-tick` (single layer is enough) and
`event-error` (replace `click` with a noise rasp at lower frequencies).

Reference: `poc/defaults.acs` → `@sound tap`, `@sound tap-tactile`, `@sound thunk`,
`@sound woodblock`.
