---
title: Decide single-layer vs multi-layer
impact: MEDIUM-HIGH
impactDescription: A satisfying click is body+click; a satisfying success is a chord. Picking the wrong layer count loses character.
tags: pipeline, layers
prompt: ""
example: |
  @sound my-tap {
    body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
    click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
  }
---

## Decide single-layer vs multi-layer

| Event class                                | Default                                       |
| ------------------------------------------ | --------------------------------------------- |
| click, tap, tick, hover, focus, swoosh     | 1 layer (`body` only)                          |
| toggle, copy, send, sync                   | 2 layers (paired pitches with `start` offsets) |
| success, complete, level-up, confetti      | 3+ layers (chord with cascading `start`)       |
| error, delete                              | 2 layers (`osc: sawtooth` + `noise: white`)    |
| any "click + body" archetype               | 2 layers (`body` + `click`)                    |

#### Per-layer gain budget

Sum of `gain` values across layers should be ≤ 0.6 to leave headroom before the
runtime calibrator. See `validate-gain-budget`.

#### Naming convention

- `body` — the tonal core (always present)
- `click` — sharp transient noise burst layered on top
- `snap` — short osc/noise stinger
- `ping`, `tail`, `noise` — additional voicings

ACS doesn't enforce key names — they're just identifiers within an `@sound`.
Keep them descriptive so the picker's drag-to-reorder UI is readable.
