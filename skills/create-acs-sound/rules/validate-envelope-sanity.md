---
title: Validate — envelope sanity
impact: MEDIUM-HIGH
impactDescription: Short envelopes with no release click. Long releases on percussive sounds tail forever.
tags: validate, envelope, attack, decay, release
prompt: ""
example: |
  /* OK — instant attack, short decay, micro release prevents click */
  @sound ok { body { tones: 1.4khz; attack: 0; decay: 50ms; release: 5ms; gain: 0.4; } }

  /* FAIL — no release; the sample-end sample-and-hold can pop */
  @sound poppy { body { tones: 1.4khz; attack: 0; decay: 50ms; gain: 0.4; } }
---

## Validate — envelope sanity

Envelopes have three knobs: `attack`, `decay`, `release`. Most UI sounds skip
`release`, but very-short percussive sounds need at least 3–5 ms release to
prevent end-of-sample clicks.

#### Sanity rules

1. **`decay > 30 ms` and `release` not set** → add `release: 5ms` to prevent clicks.
2. **`attack > decay`** → unusual; reads as "rising tone". Double-check intent.
3. **`release > 0.5 × decay`** → release dominates; rare for percussive UI. Often a copy-paste error.
4. **`attack > 50 ms` on a click/tap event** → defeats the "instant" feel. Set to 0.
5. **`decay < 5 ms`** → audible only as a click, not a tone. Use `noise` source instead.

#### Why micro-release matters

When a layer's amplitude drops to 0 instantaneously (no release), the sample
can end on a non-zero value, producing a discontinuity that the speaker
reproduces as a click. A 3–5 ms linear ramp to zero eliminates the artifact
without making the sound feel "squishy".

The runtime applies a tiny default release of 1 ms internally, but explicit
`release` in the `@sound` overrides it — so authors should either omit the
key entirely (lets the runtime handle it) or set a value ≥ 3 ms.

#### Multi-layer envelope coordination

When a preset has multiple layers, their envelopes don't have to match — but
they should be consistent in *style*. A preset with one snappy layer and one
sustained layer feels confused. Either all layers are percussive (no release,
short decay), or all are sustained (longer decay, audible release).

Reference: `poc/runtime/dsp.js` → envelope branch.
