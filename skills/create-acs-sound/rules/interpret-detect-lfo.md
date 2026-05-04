---
title: Interpret — detect LFO modulation (FM, vibrato)
impact: MEDIUM
impactDescription: Sidebands around the fundamental indicate modulation. FM is the most ACS-relevant case.
tags: interpret, lfo, fm, modulation
prompt: ""
example: |
  /* Output:
   *   fm: { ratio: 1.5, depth: 80 }       — FM detected
   *   detune: 10                          — detune detected (no LFO depth, just static cents)
   */
---

## Interpret — detect LFO modulation

If the spectrum around the fundamental shows symmetric sideband peaks, FM is
in play. The sideband spacing reveals the modulator frequency; the sideband
strength reveals the depth.

#### FM detection

```python
peaks = find_spectral_peaks(spectrum, freqs)
fundamental = fundamental_freq

# Find peaks within an octave of the fundamental, sorted by strength.
# Symmetric pairs around the fundamental (f ± k·m) indicate FM with
# modulator frequency m and modulation index proportional to k.

sideband_pairs = find_symmetric_sidebands(peaks, fundamental)
if sideband_pairs:
    modulator_hz = sideband_pairs[0].spacing
    ratio = modulator_hz / fundamental
    depth = estimate_depth_from_sideband_amplitudes(sideband_pairs)
    return { "fm": { "ratio": round(ratio, 2), "depth": int(depth) } }

return None
```

#### Mapping to ACS

| Detection                                | Emit                                       |
| ---------------------------------------- | ------------------------------------------ |
| Symmetric sidebands at f ± k × m         | `fm: { ratio: m/f, depth: <Hz> }`           |
| Single peak near fundamental, no sidebands | nothing — pure carrier                    |
| Multiple closely-spaced peaks (< 20 cents) | `detune: <cents>` (not FM)                |
| Slow amplitude wobble (no spectral sidebands) | tremolo — not directly expressible in ACS DSL; comment in output |

#### FM ratio interpretation

| Ratio        | Character                                    |
| ------------ | -------------------------------------------- |
| 0.5          | Sub-octave modulator → adds dark body        |
| 1.0          | Carrier modulates itself → phase distortion  |
| 1.5          | Perfect fifth above → classic bell           |
| 2.0          | Octave above → brighter bell                 |
| 2.76         | Inharmonic Chowning ratio → most bell-like   |
| Non-integer  | Inharmonic; emit as-is                       |

Round to two decimal places when emitting.

#### Depth interpretation

Modulation index converts to ACS `depth` (Hz) directly. Typical UI range:
30–200. Above 300, the sound becomes unstable / metallic — the agent should
note this in the rationale even if measured.

Reference: `poc/runtime/dsp.js` → `playOscLayer()` FM branch.
