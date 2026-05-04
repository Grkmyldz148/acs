---
title: Interpret — detect multi-layer source
impact: MEDIUM-HIGH
impactDescription: Many UI sounds are layered. Treating them as single-source produces lossy reconstruction.
tags: interpret, multi-layer
prompt: ""
example: |
  /* Output: a multi-layer @sound with body + click layers */
  @sound reconstructed {
    body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
    click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
  }
---

## Interpret — detect multi-layer source

A single-source model often can't fit the whole audio file — there's residual
energy that doesn't belong to the modeled body. The skill's job is to recognize
when this residual is itself a *layer*, not just noise to be discarded.

#### Algorithm

1. After running `interpret-extract-source` + `interpret-extract-envelope`,
   synthesize the modeled body via `analyzer/render.mjs`.
2. Subtract the synthesized body from the original. Compute residual RMS.
3. If residual RMS > 10% of original RMS → a second layer exists.
4. Re-run `interpret-extract-source` etc. on the residual — that's the second layer.

#### Common multi-layer archetypes

| Pattern                                                   | Likely shape                              |
| --------------------------------------------------------- | ----------------------------------------- |
| Tonal body + brief broadband transient at onset           | `layer-click-plus-body` (body + click)    |
| Two tonal peaks with slightly offset onsets               | `layer-octave-pair` or chord              |
| Three or more tonal peaks with cascading onsets           | `layer-ascending-chord`                   |
| Tonal body + sustained noise (e.g., rain on a bell)       | body + noise pad — both stay full duration |

#### Layer naming

When emitting, name layers by role:

- **Tonal core, longest decay** → `body`
- **Sharp transient at onset** → `click`
- **Higher-pitched stinger** → `snap` or `ping`
- **Sustained background texture** → `pad` or `tail`

#### Stop condition

If residual RMS drops below 5% of original after subtracting the second layer,
stop. Most UI sounds are 1–2 layers; 3-layer reconstructions exist (success
chord) but past 3 the model is overfitting the audio rather than capturing
authorial intent.

Reference: `analyzer/render.mjs` for synthesis (the inverse step).
