---
title: Interpret — extract source type
impact: HIGH
impactDescription: First and most important interpret step. Wrong source type makes every later step wrong.
tags: interpret, source, audio
prompt: ""
example: |
  /* No example — this rule fires on audio input only.
   * Output is one of: tones, modal, osc, pluck, noise. */
---

## Interpret — extract source type

Given a mono WAV file, decide which ACS source primitive best models it.
Decision is based on three measurements: **harmonic structure**, **decay shape**,
and **broadband energy**.

#### Decision tree

```
Spectral structure?
├─ Strong tonal peaks at integer multiples (1, 2, 3, …)
│  └─ Decay shape?
│     ├─ Smooth exponential, all partials decay together
│     │  └─ source: tones (additive sine bank)
│     ├─ Each partial has independent decay rate (high partials die first)
│     │  └─ source: modal (modal IIR resonator)
│     └─ Single partial, slowly damped
│        └─ source: pluck (Karplus-Strong)
├─ Strong tonal peaks at NON-integer multiples (inharmonic)
│  └─ source: modal (with custom ratios)
├─ Continuous spectrum (no isolated peaks)
│  └─ source: noise
│     ├─ Roughly flat spectrum   → noise: white
│     ├─ -3 dB/octave roll-off    → noise: pink
│     └─ -6 dB/octave roll-off    → noise: brown
└─ Single dominant peak with no harmonics, fixed waveform shape
   └─ source: osc (with classify-waveform downstream)
```

#### Measurement script

```python
from analyze import load_mono, harmonic_strength, decay_independence, spectral_flatness

sr, data = load_mono("out/click.wav")

harmonic   = harmonic_strength(data, sr)        # 0..1
indep      = decay_independence(data, sr)       # 0..1 (1 = each partial decays at own rate)
flatness   = spectral_flatness(data, sr)        # 0..1 (1 = perfectly flat = noise)

if flatness > 0.7:
    return "noise"
if harmonic > 0.5:
    return "modal" if indep > 0.5 else "tones"
return "osc"   # fallback — single peak, likely a basic waveform
```

#### Heuristic shortcuts

- **Decay < 50 ms + broadband**: almost always `noise` (e.g., a click or snare).
- **Sustained tone > 200 ms**: almost always `tones` or `modal`.
- **Pitch sweep audible**: tag with `pitch-from` regardless of source type.
- **Inharmonic ratio (e.g., 2.76) detected**: definitely `modal`, not `tones`.

Reference: `analyzer/render.mjs` (the inverse — synthesizes from source) gives
the canonical mapping you should match.
