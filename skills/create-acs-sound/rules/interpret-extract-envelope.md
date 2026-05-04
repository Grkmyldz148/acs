---
title: Interpret — extract ADSR envelope
impact: HIGH
impactDescription: Smooth amplitude, find onset/peak/sustain/end, derive ADSR stages.
tags: interpret, envelope, adsr
prompt: ""
example: |
  /* Output for a click WAV:
   *   { attack: 0, decay: 12ms, release: 5ms }
   *
   * Output for a sustained tone:
   *   { attack: 4ms, decay: 50ms, sustain: 0.6, release: 80ms }
   */
---

## Interpret — extract ADSR envelope

Smooth the time-domain amplitude into a low-rate envelope curve, then find the
four ADSR stage boundaries.

#### Algorithm

```python
from analyze import load_mono, extract_envelope

sr, data = load_mono("out/click.wav")
env = extract_envelope(data, sr)
# -> { "attack": 0.0008, "decay": 0.012, "sustain": 0.0, "release": 0.005 }
```

Internally `extract_envelope` does:

1. Take absolute value of waveform.
2. Apply a one-pole lowpass smoother (~100 Hz cutoff) to remove waveform-rate detail.
3. Find onset (first sample where envelope > 0.05 × peak).
4. Find peak (max of smoothed envelope).
5. Define `attack = peak_time - onset_time`.
6. Find sustain start: first sample after peak where envelope plateaus
   (slope < 1% of attack slope) for at least 30 ms; else sustain = 0.
7. Define `decay = sustain_start - peak_time` if sustain detected, else
   `decay = end_time - peak_time` (whole tail is decay).
8. If sustain detected, define `release = end_time - sustain_end`; else
   release = small constant (5 ms) to prevent click on emit.

#### Heuristics for ACS emit

- **`sustain < 0.01`** → drop the field entirely; the sound is percussive and
  ACS's envelope DSL doesn't require explicit sustain=0.
- **`attack < 0.001`** → set `attack: 0` (the runtime treats <1 ms attack as
  instant).
- **`release < 0.003`** → clamp to `0.005` to avoid clicks at sample end.
- **`decay > 2 s`** → almost certainly room reverb tail bleeding into the
  measurement; cap at the room's known tail length and emit `room: <name>`
  separately. See `interpret-detect-effects`.

#### When the source is `noise`

For broadband noise sources, replace `extract_envelope` with the same algorithm
applied to the broadband energy curve (RMS-windowed, not waveform). The result
maps to the same ACS keys.

Reference: `analyzer/render.mjs` envelope branch (inverse — synthesizes from ADSR).
