---
title: Layer — ascending chord
impact: MEDIUM-HIGH
impactDescription: Three or more notes spelling out a chord with cascading start times.
tags: layer, chord, ascending, success
prompt: "success complete achievement level-up chord triumph"
example: |
  @sound my-success {
    n1 { tones: 660hz;  decay: 250ms; gain: 0.22; }
    n2 { tones: 880hz;  start: 80ms;  decay: 300ms; gain: 0.22; }
    n3 { tones: 1320hz; start: 160ms; decay: 350ms; gain: 0.22; }
  }
---

## Layer — ascending chord

Three (or four) layers, each a tone in a major chord, with `start` offsets that
cascade by 60–120 ms. Used for `success`, `complete`, achievement / level-up /
confetti events.

#### Why three notes?

Three notes is the inflection point: two notes feel like a paired-state cue
(see `layer-octave-pair`); four+ notes feel like a melody rather than a UI
beat. Three is "chord" without being "tune".

#### Picking the chord

The default is a **major triad** (root + major third + perfect fifth):

| Chord type | Frequencies (root = 660 Hz) | Vibe                     |
| ---------- | ---------------------------- | ------------------------ |
| Major      | 660, 825, 990                | Bright, classic positive |
| Sus4       | 660, 880, 990                | Open, pending resolution |
| Octaves    | 660, 1320, 1980              | Pure, less melodic       |
| Minor      | 660, 792, 990                | Don't — minor + UI = bad |

The example above uses simple integer ratios (1, 1.33, 2) which approximate a
"power chord" voicing — more direct than a true major triad, easier on the ear
in repeated UI contexts.

#### Cascading `start`

`start` offsets should *increase* with frequency for ascending success vibe.
Reverse for descending events (rare in UI, but possible for "level lost" /
"countdown ended").

A typical pattern:

```
n1: start: 0ms      lowest pitch
n2: start: 80ms     middle
n3: start: 160ms    highest
```

Total duration = `last start + last decay` ≈ 500 ms. Past 700 ms, the sound
starts feeling like a notification ringtone — too prescriptive.

#### Per-layer gain

Keep all layers at the *same* gain (0.18–0.25). If the third layer is louder
than the first, the chord feels lopsided.

Reference: `poc/defaults.acs` → `@sound success`, `@sound complete`.
