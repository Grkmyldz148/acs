---
title: Interpret — classify oscillator waveform
impact: HIGH
impactDescription: When source = osc, this rule decides which waveform.
tags: interpret, waveform, classification, osc
prompt: ""
example: |
  /* Classification output:
   *   "sine"     → osc: sine
   *   "triangle" → osc: triangle
   *   "square"   → osc: square
   *   "sawtooth" → osc: sawtooth
   */
---

## Interpret — classify oscillator waveform

Compare the amplitudes of the first 8 harmonics against the fundamental.
Each canonical waveform has a known signature.

#### Algorithm

```python
import numpy as np
from scipy.fft import rfft, rfftfreq
from analyze import classify_waveform

# Use a stable window after the attack transient
segment = data[int(sr * 0.005) : int(sr * 0.025)]   # 5–25 ms
segment = segment * np.hanning(len(segment))
spectrum = np.abs(rfft(segment))
freqs = rfftfreq(len(segment), 1 / sr)

waveform = classify_waveform(spectrum, freqs, fundamental_freq)
# -> "sine" | "triangle" | "square" | "sawtooth" | "wavetable"
```

#### Signature mapping

| Pattern                                         | Waveform     |
| ----------------------------------------------- | ------------ |
| Fundamental only, harmonics < -40 dB            | `sine`       |
| Odd harmonics rolling off as 1/n²               | `triangle`   |
| Odd harmonics at roughly 1/n amplitude          | `square`     |
| All harmonics rolling off as 1/n                | `sawtooth`   |
| Custom harmonic profile (none of the above)     | (no match — wavetable not yet supported in ACS DSL; fall back to closest match) |

#### Decision details

- **Sine vs triangle**: sine has the second harmonic at silence; triangle has
  the third at -19 dB. If H3 > -30 dB → triangle.
- **Square vs sawtooth**: square has only odd harmonics; sawtooth has all.
  Check H2: if H2 < -25 dB → square; else sawtooth.
- **Confidence threshold**: if no clean match (max correlation < 0.8 with any
  template), this isn't a clean osc — re-check `interpret-extract-source`,
  the source is probably `tones` or `modal`.

#### When this rule fires

Only when `interpret-extract-source` chose `osc`. For `tones`/`modal`/`pluck`/`noise`,
waveform classification is meaningless.

Reference: `analyzer/render.mjs` osc branch.
