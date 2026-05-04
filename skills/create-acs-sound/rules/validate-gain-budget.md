---
title: Validate — gain budget
impact: HIGH
impactDescription: Sum-of-gains over budget produces clipping; a calibrated runtime can compensate but only so far.
tags: validate, gain, budget
prompt: ""
example: |
  /* OK — budget = 0.4 + 0.3 = 0.7 (within 1.0 limit, headroom remains) */
  @sound ok {
    body  { tones: 1khz; decay: 50ms; gain: 0.4; }
    click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
  }

  /* FAIL — budget = 0.6 + 0.5 + 0.4 = 1.5; the calibrator scales, but tonally muddied */
  @sound fail {
    body { ...; gain: 0.6; }
    midd { ...; gain: 0.5; }
    high { ...; gain: 0.4; }
  }
---

## Validate — gain budget

After emit, sum every layer's `gain`. The total should be:

| Sum             | Verdict                                                 |
| --------------- | ------------------------------------------------------- |
| ≤ 0.6           | ✅ Comfortable. Plenty of calibration headroom.          |
| 0.6 – 0.9       | ⚠️ Acceptable but tight. Calibrator may scale aggressively. |
| 0.9 – 1.2       | ❌ Reject. Re-emit with proportionally lower gains.      |
| > 1.2           | ❌ Hard reject. This will clip.                          |

#### Why the budget exists

ACS's calibrator measures every preset offline and bakes a multiplier so
`volume: 0.5` sounds equally loud across the library. If the raw `gain`
values are too hot, the calibrator's headroom shrinks — bright sources end
up sounding compressed, dull sources end up under-leveled.

The 0.6 budget gives the calibrator at least 4 dB to work with on the upper
end (loud presets) and 2 dB on the lower end (quiet presets), maintaining
the 4.8 dB target spread.

#### How to fix overruns

1. **Halve every gain proportionally** — if budget = 1.2, multiply each layer's
   gain by 0.5. The relative balance is preserved; total drops to 0.6.
2. **Drop the least-essential layer** — for `success`-style chords, dropping
   the third tone is often inaudible.
3. **Move shaping into `drive`** — perceived loudness can come from saturation
   rather than gain. `drive: 0.3` adds harmonic content without consuming
   gain budget.

Reference: `poc/runtime/calibrate.js`.
