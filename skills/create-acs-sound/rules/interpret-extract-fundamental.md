---
title: Interpret — extract fundamental frequency and pitch sweep
impact: HIGH
impactDescription: The pitched core of the sound. Static or sweeping — this rule decides.
tags: interpret, fundamental, pitch, sweep
prompt: ""
example: |
  /* For audio with static pitch:           freq: 880hz                  */
  /* For audio with descending pitch sweep: pitch-from: 880hz to 440hz   */
---

## Interpret — extract fundamental frequency and pitch sweep

Sample the spectrum at multiple time slices to detect both the static pitch and
any sweep over the duration of the sound.

#### Slice-and-FFT approach

```python
from analyze import load_mono, analyze_slice

sr, data = load_mono("out/click.wav")

# Take FFT slices at 0%, 10%, 25%, 50%, 75% of duration
duration = len(data) / sr
slices = [0, duration * 0.1, duration * 0.25, duration * 0.5, duration * 0.75]
freqs_over_time = [analyze_slice(data, sr, t) for t in slices]
```

#### Mapping

| Observation                         | Output                                           |
| ----------------------------------- | ------------------------------------------------ |
| All slices within ±5%               | `freq: <Hz>` (static)                             |
| Decreasing across slices            | `pitch-from: <high>hz to <low>hz`                 |
| Increasing across slices            | `pitch-from: <low>hz to <high>hz`                 |
| Non-monotonic (zigzag)              | Pick start and end as `pitch-from`; the runtime interpolates linearly. |
| No clear peak (broadband)           | This isn't a tonal sound — see `interpret-extract-source`. |

#### Tips

- Skip the first 1–2 ms if the onset is a click transient — the click pollutes
  the FFT with broadband energy.
- For very short sounds (< 20 ms), reduce to 2–3 slices and use a smaller FFT
  window (e.g., 256 samples).
- Use a Hanning window before FFT (already applied in `analyze_slice`) to
  reduce spectral leakage at slice boundaries.

#### When the source is `noise`

`noise` has no fundamental — but if a bandpass filter is detected (see
`interpret-detect-filter`) the bandpass center can sweep, which produces the
same audible effect. Emit `pitch-from` on the bandpass `cutoff` rather than
on a non-existent fundamental.

Reference: see `interpret-detect-filter` for filter-sweep extraction.
