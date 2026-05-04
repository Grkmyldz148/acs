---
title: Layer — octave pair (toggle, paired states)
impact: MEDIUM-HIGH
impactDescription: Two layers spaced an octave apart. Used for paired-state events.
tags: layer, octave, toggle
prompt: "toggle switch on off paired state"
example: |
  @sound my-toggle-on {
    low  { tones: 660hz;  decay: 80ms; gain: 0.25; }
    high { tones: 1320hz; start: 30ms; decay: 60ms; gain: 0.2; }
  }
---

## Layer — octave pair

Two body layers tuned an octave apart, the higher one delayed by a small `start`
offset (20–60 ms). The result is a brief two-note "rising tap" — very natural
for toggle-on, copy-confirm, send-success, and similar paired-state events.

#### Why two octaves apart?

An octave is the most consonant interval — the higher tone reinforces the
fundamental's perceived pitch rather than competing with it. Two notes separated
by anything other than an octave (perfect fifth, third, etc.) start to feel like
a chord, which carries more melodic intent than a UI sound usually wants.

#### Direction asymmetry

Use **higher delayed** (`start: 30ms` on the high layer) for "ON" / "confirm" /
"send" — the rising motion reads as positive activation.

Use **lower delayed** for "OFF" / "cancel" — descending feels deactivating.

#### Toggle-off variant

```css
@sound my-toggle-off {
  high { tones: 1320hz; decay: 60ms; gain: 0.22; }
  low  { tones: 660hz;  start: 30ms; decay: 80ms; gain: 0.25; }
}
```

Same notes, swapped order — descending instead of ascending.

#### Anti-patterns

- **Both layers starting at `start: 0`**: collapses to a fused chord, loses the
  paired-state perception.
- **Octave gap > 1 octave**: 2 octaves = bell-like ring (too long); 3 octaves =
  the high tone is barely audible. One octave is the sweet spot.

Reference: `poc/defaults.acs` → `@sound toggle-on`, `@sound toggle-off`.
