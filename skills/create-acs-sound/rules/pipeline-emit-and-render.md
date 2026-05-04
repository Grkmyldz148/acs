---
title: Emit, optionally render, optionally round-trip
impact: HIGH
impactDescription: Final step. Output must be paste-ready ACS plus a short rationale.
tags: pipeline, output
prompt: ""
example: |
  @sound my-click {
    body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.18; }
  }
---

## Emit, optionally render, optionally round-trip

#### 1. Emit

Always return paste-ready ACS:

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.18; }
}
```

Plus a one-line rationale that names the prompt tokens you acted on:

> "click" → base from `event-click`; "warm" → kept default sine, no extra filter needed at 1.3 kHz.

#### 2. Optional preview render

If the user asked for a WAV (or you want to grade your own output):

```bash
node analyzer/render.mjs my-click --out preview.wav --duration 0.3
```

Set `duration ≥ attack + decay + release + 0.05`, plus the room tail if `room` is non-`dry`.

#### 3. Optional round-trip validation

| Field             | Acceptable drift                            |
| ----------------- | ------------------------------------------- |
| Fundamental Hz    | ±5%                                         |
| Attack            | ±2 ms                                       |
| Decay             | ±10%                                        |
| Spectral centroid | ±20% of expected for the chosen waveform    |

If drift exceeds tolerance, refine (often via `gain` / `decay` / `cutoff`) and re-render.
