---
title: Effect — bandpass + noise for swoosh
impact: MEDIUM
impactDescription: Texture, not pitch. Bandpass center-frequency sweep produces "whoosh".
tags: effect, bandpass, noise, swoosh
prompt: "swoosh whoosh slide transition"
example: |
  @sound my-swoosh {
    body {
      noise: white;
      filter: bandpass; cutoff: 1500hz; q: 1.5;
      pitch-from: 800hz to 3000hz;
      decay: 250ms;
      gain: 0.35;
    }
  }
---

## Effect — bandpass + noise for swoosh

A bandpass filter applied to a noise source produces a band-limited "shhh"
texture. Sweeping the center frequency over time (via `pitch-from`) moves
the perceived band, creating the universal "whoosh" effect.

#### Sweep direction

- **Low → High**: ascending whoosh — feels like something rising or sliding in.
- **High → Low**: descending — feels like something falling away or transitioning out.

#### Q controls "tightness"

| Q value | Character                                       |
| ------- | ----------------------------------------------- |
| 0.7     | Wide, breath-like — more "wind", less direction |
| **1.5** | **Default** — clear directional swoosh          |
| 3.0     | Tight, nearly tonal — laser-zip vibe             |
| 6.0+    | Self-oscillating ring — too narrow for noise    |

#### Sweep range

| Range (Hz)        | Vibe                                  |
| ----------------- | ------------------------------------- |
| 200 → 800         | Low whoosh, bass-heavy                |
| **800 → 3000**    | **Mid sweep — UI page transition**    |
| 1500 → 5000       | High whoosh, more "swish"             |
| 200 → 5000        | Wide cinematic sweep                  |

#### Noise color

- `noise: white` — bright, modern (default for UI).
- `noise: pink` — softer, more analog feel.
- `noise: brown` — bass-heavy, rumbly (rare for UI; use for cinematic).

Reference: `poc/defaults.acs` → `@sound swoosh`, `@sound whoosh`.
