---
title: Validate — frequency bounds
impact: HIGH
impactDescription: Out-of-band fundamentals waste energy and can clip the limiter.
tags: validate, frequency, bounds
prompt: ""
example: |
  /* OK — fundamental at 880 Hz, well within UI band */
  @sound ok { body { tones: 880hz; decay: 200ms; gain: 0.3; } }

  /* FAIL — 30 Hz fundamental: wasted energy, sub-bass on most speakers */
  @sound bad-low { body { tones: 30hz; decay: 200ms; gain: 0.3; } }

  /* FAIL — 12 kHz fundamental: piercing, fatigues the ear */
  @sound bad-high { body { tones: 12000hz; decay: 200ms; gain: 0.3; } }
---

## Validate — frequency bounds

UI sounds need to live within a frequency band where:

1. Most consumer speakers can reproduce them.
2. The ear hears them as "tones", not "thumps" or "whistles".
3. Repeated triggers don't fatigue the listener.

#### Recommended bounds

| Band           | Range          | Use case                                  |
| -------------- | -------------- | ----------------------------------------- |
| Reject (low)   | < 80 Hz        | Sub-bass; not for UI sounds               |
| **Body band** | **80 – 4000 Hz** | **Fundamentals live here**                |
| Click band     | 4 – 8 kHz      | Click layers in `layer-click-plus-body`   |
| Reject (high)  | > 10 kHz       | Piercing; fatiguing on repeats            |

#### Per-source-type guidance

- **`tones`** / **`modal`** — fundamentals must be 80–4000 Hz. Higher partials
  (modal `ratios`) can extend to 10 kHz.
- **`pluck`** — 80–2000 Hz works; above 2 kHz sounds artificial.
- **`osc`** with `pitch-from` — both `start` and `end` should be in 80–4000 Hz.
- **`noise` + bandpass `cutoff`** — center 1–6 kHz; above 8 kHz the noise sounds
  like crystal hiss rather than a swoosh.

#### Validation step

When emitting an `@sound`, scan every frequency-typed value (`freq`, `cutoff`,
`tones`, `modal`, both ends of `pitch-from`) and assert it's in the recommended
band for its source type. If out of bounds, reject and re-emit with a clamped
value:

```
freq = clamp(intended, 80, 4000)
cutoff = clamp(intended, 200, 8000)
```

Reference: `poc/runtime/parse.js` → `parseFreq()`.
