---
title: Mood — lofi
impact: HIGH
impactDescription: The most-requested aesthetic mood. Combines lowpass + sample-rate reduction + wow/flutter.
tags: mood, lofi, retro, vintage
prompt: "lofi lo-fi cassette tape vintage muffled"
example: |
  /* Path 1 — runtime overlay (preferred for global aesthetic): */
  .lofi-app { sound-mood: lofi; sound-mood-mix: 0.7; }

  /* Path 2 — bake into a single @sound: */
  @sound my-lofi-tap {
    body {
      tones: 720hz;
      filter: lowpass; cutoff: 1800hz;
      detune: 8;            /* tape wobble approximation */
      decay: 60ms;
      gain: 0.35;
    }
  }
---

## Mood — lofi

The lofi aesthetic combines three ingredients that the runtime overlay applies as a
chain on top of the dry signal:

1. **Lowpass at ~2 kHz** — strips the digital top-end that screams "modern".
2. **Sample-rate reduction to ~16 kHz** — that subtle aliased "buzz" you hear
   in cassette and 80s digital gear.
3. **Wow/flutter LFO** — a 0.5–1.5 Hz sine modulation on pitch (~10 cents depth)
   that mimics tape transport instability.

Baking lofi into a single `@sound` is harder because (2) and (3) are not easily
expressible per-layer. The runtime overlay (`sound-mood: lofi`) is almost always
the right call — apply it on a wrapping element and every sound triggered inside
inherits the treatment.

#### Mix is important

`sound-mood-mix: 1.0` is "full lofi" — heavy and intentional. For most apps that
want a *touch* of lofi (say a creative tool with a vintage UI vibe), use
`sound-mood-mix: 0.4..0.6` so the original sound's clarity isn't lost.

#### Don't combine with

- **`mood: bright`** — the lowpass directly contradicts the high-shelf.
- **`event-error`** — lofi softens the error's urgency, defeats the purpose.

#### Pair well with

- `poc/themes/retro.acs` — the retro theme already biases toward lofi-friendly presets.
- Long decays + `room: plate` — the lofi reverb tail is a recognized aesthetic.

Reference: `poc/runtime/mood.js` → `MOODS.lofi`.
