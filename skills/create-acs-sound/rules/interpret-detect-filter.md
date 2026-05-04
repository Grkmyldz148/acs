---
title: Interpret — detect filter
impact: MEDIUM-HIGH
impactDescription: A spectral roll-off or band-limit usually means a filter is in play.
tags: interpret, filter, lowpass, highpass, bandpass
prompt: ""
example: |
  /* Output:
   *   filter: lowpass; cutoff: 2500hz
   *   filter: bandpass; cutoff: 1500hz; q: 1.5
   */
---

## Interpret — detect filter

Compare the source's expected spectrum (based on `interpret-classify-waveform`
or the noise color from `interpret-extract-source`) against the measured
spectrum. A consistent roll-off, lift, or band-limit indicates a filter.

#### Decision tree

```
Measured spectrum matches the source's natural spectrum?
├─ Yes → no filter
└─ No  → which deviation?
   ├─ Energy drops sharply above some frequency → lowpass
   ├─ Energy drops sharply below some frequency → highpass
   ├─ Energy concentrates around some frequency → bandpass
   ├─ Energy notched at one frequency           → notch (rare in ACS UI)
```

#### Cutoff extraction

For lowpass/highpass: find the -3 dB point (frequency where the log-magnitude
spectrum is 3 dB below the in-band plateau). That's `cutoff`.

For bandpass: find the spectral peak — that's `cutoff`. Width at -3 dB gives Q:
`Q ≈ cutoff / bandwidth`.

#### Heuristics

- **Sharp roll-off (12 dB/octave or steeper)** → use `tpt-lowpass` /
  `tpt-highpass` / `tpt-bandpass` — the runtime's TPT-SVF filters.
- **Gentle roll-off (6 dB/octave)** → use the regular `lowpass` / `highpass`.
- **Visible resonance peak at cutoff** → emit `q` ≥ 2; otherwise omit `q`
  (default 0.7 Butterworth).

#### When filter is "free" (no detection needed)

If `interpret-extract-source` chose `noise` and the spectrum has any
frequency dependence, you must emit a filter — the runtime's noise sources are
flat (white) / -3 dB/oct (pink) / -6 dB/oct (brown). Anything else is a filter.

Reference: `poc/runtime/dsp.js` filter branch.
