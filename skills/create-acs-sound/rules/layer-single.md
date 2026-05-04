---
title: Layer — single body
impact: HIGH
impactDescription: The default. Most UI sounds are one layer. Don't over-stack.
tags: layer, single
prompt: "click tap tick hover focus single simple"
example: |
  @sound my-single {
    body { osc: sine; freq: 1300hz; decay: 12ms; gain: 0.22; }
  }
---

## Layer — single body

A single-layer `@sound` has one block called `body`. This is the default for:

- Clicks, taps, ticks, hovers, focus events
- Any short transient (< 100 ms decay)
- Any sound where layering would muddy the identity

The convention is to name the layer `body` even when there's only one — this leaves
room to add a `click` layer later (see `layer-click-plus-body`) without renaming.

#### What goes inside `body`?

Pick exactly **one** source key (`tones` / `modal` / `osc` / `pluck` / `noise`),
optionally add modulation (`fm`, `pitch-from`, `detune`), envelope (`attack`,
`decay`), and output (`gain`, `pan`, `drive`). The runtime applies them in this order:

```
source → fm → detune → filter → envelope → drive → pan → output
```

#### Anti-patterns

- **Empty layer**: `body { gain: 0.3; }` — no source key. Runtime fails silently.
- **Two source keys in one layer**: `body { tones: 880hz; modal: 660hz; }` — the
  parser keeps the last one. Use two layers instead.
- **`gain: 1.0`**: hot-clipping. Calibrator scales down but you waste headroom.

Reference: `poc/runtime/dsp.js` → `playLayer()`.
