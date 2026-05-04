---
title: Interpret — detect reverb / delay / saturation
impact: MEDIUM
impactDescription: Effects extend the sound's footprint. Misidentifying the source as part of the body wastes layers.
tags: interpret, effects, reverb, delay, saturation
prompt: ""
example: |
  /* Output (these become per-element cascade rules, not @sound-internal):
   *   room: small-room       (when reverb tail detected)
   *   drive: 0.4              (when soft saturation detected)
   */
---

## Interpret — detect reverb / delay / saturation

After source + envelope are extracted, look at what's left in the audio after
the modeled body decays. Anything beyond is an effect.

#### Detect reverb

Subtract the modeled body (synthesize via the chosen source + envelope) from
the original. The residual:

| Residual character                                  | Verdict                                    |
| --------------------------------------------------- | ------------------------------------------ |
| Diffuse, broadband, slow decay (> 200 ms)           | Reverb. Match tail length to a `room`.     |
| Discrete repeats at ~50–500 ms intervals            | Delay. Not a primary ACS DSL key — emit a comment.       |
| Continues at low level after body's expected end    | Likely reverb tail; estimate room.         |
| Nothing (residual is silent within tolerance)       | No effects. Body fully explains the audio. |

Map the residual's tail length to a room:

| Tail length | Room               |
| ----------- | ------------------ |
| < 0.2 s     | dry (no emit)      |
| 0.2 – 0.6 s | `small-room`       |
| 0.6 – 1.2 s | `medium-room`      |
| 1.2 – 2.0 s | `large-room`       |
| 2.0 – 3.5 s | `hall`             |
| 0.8 – 1.5 s, dense bright | `plate` |

Note: ACS rooms are per-element, not per-`@sound`. Emit room as a recommendation
for the cascade rule that uses the new preset, not inside the `@sound` block:

```css
@sound my-bell { body { tones: 880hz, 1320hz; decays: 0.6s, 0.4s; gain: 0.32; } }

/* Skill output also includes: */
/* dialog[open] { sound-on-appear: my-bell; room: small-room; } */
```

#### Detect saturation

Compare the harmonic content of the body to its source-type's expected content.
Excess even harmonics (esp. H2 at -20 to -10 dB) indicates soft saturation.

Map saturation amount to `drive`:

| Excess H2 level | `drive` value |
| --------------- | ------------- |
| < -25 dB        | 0 (no emit)   |
| -25 to -15 dB   | 0.2           |
| -15 to -8 dB    | 0.4           |
| -8 to -3 dB     | 0.6           |
| > -3 dB         | 0.8 (strong distortion — verify intent) |

`drive` is a per-layer key, so it goes inside the layer block.

#### Detect chorus / detune

Multiple closely-spaced peaks around the fundamental (within ±20 cents)
indicates detune. Emit `detune: <cents>` on the layer.

Reference: `poc/runtime/audio.js` (rooms), `poc/runtime/dsp.js` (drive, detune).
