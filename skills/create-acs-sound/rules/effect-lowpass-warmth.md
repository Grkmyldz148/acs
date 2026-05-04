---
title: Effect — lowpass for warmth
impact: HIGH
impactDescription: The most-applied effect. Cuts brittleness; the agent's go-to for "warmer".
tags: effect, lowpass, warmth, filter
prompt: "warm warmer mellow soft muffled"
example: |
  @sound my-warm {
    body {
      tones: 660hz, 990hz;
      decays: 0.5s, 0.35s;
      filter: lowpass; cutoff: 2500hz;     /* warmth */
      gain: 0.32;
    }
  }
---

## Effect — lowpass for warmth

A lowpass filter on the body layer attenuates frequencies above the cutoff —
removing the high-frequency content that the ear reads as "brittle", "sharp",
or "digital". The result feels softer, more analog, more present without being
piercing.

#### Cutoff calibration table

| Cutoff       | Effect                                                          |
| ------------ | --------------------------------------------------------------- |
| 800 Hz       | Muffled / "telephone" quality. Use only for `lofi` aesthetic.    |
| 1500 Hz      | Strong warmth; loses some clarity.                               |
| **2200–2800 Hz** | **Sweet spot** — clearly warmer without losing intelligibility. |
| 3500 Hz      | Subtle hint of warmth.                                           |
| > 5000 Hz    | No audible change for most UI sounds.                            |

When the agent's brief says "warmer", the default cutoff is **2500 Hz**.
"Much warmer" → drop to 1800 Hz. "A touch warmer" → raise to 3200 Hz.

#### Q (resonance)

The runtime supports `q: <n>` on filters. For lowpass *warmth*, **don't set Q**
— a resonance peak at the cutoff produces a whistle that defeats the warming
effect. Default Q = 0.7 (Butterworth) is correct.

#### When to apply

- Prompt qualifier "warmer" / "softer" / "mellower".
- High-frequency presets (any preset whose body fundamental ≥ 1.5 kHz) that
  the user finds too sharp.
- Any preset paired with `mood: warm` if the runtime overlay alone isn't enough.

#### When NOT to apply

- Already-warm sounds (sub-1 kHz fundamentals) — they're not the problem.
- Click layers in `layer-click-plus-body` — those are *supposed* to be sharp.
- Error events — the warmth softens the dissonance.

Reference: `poc/runtime/dsp.js` → `playLayer()` filter branch.
