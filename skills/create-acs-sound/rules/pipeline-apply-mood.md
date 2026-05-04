---
title: Apply mood adjectives onto the base layer
impact: HIGH
impactDescription: Adjectives carry intent; ignoring them produces a generic-sounding preset.
tags: pipeline, mood
prompt: ""
example: |
  /* Base from event-bell + mood-warm + mood-airy:
   *   warm → add filter: lowpass; cutoff: 2500hz to body
   *   airy → +20% decay tail
   */
---

## Apply mood adjectives onto the base layer

After `pipeline-pick-base-layer` produces a starting `@sound`, scan the prompt for
adjective tokens and apply each `mood-*` rule's mutation in order:

1. **Source-shape adjectives** (`warm`, `bright`, `glassy`, `metallic`, `lofi`, `retro`, `organic`) — mutate source key, add `filter`, change waveform.
2. **Envelope adjectives** (`punchy`, `airy`) — adjust `attack` / `decay`.
3. **Effect adjectives** (`reverby`, `delayed`, `crushed`) — usually become per-element `room: …` or stacked `sound-mood`.

#### Two paths to apply mood

ACS has two ways:

1. **Bake into the @sound itself** — adjust source/envelope/filter directly. Use this when the adjective is part of the sound's identity ("a warm bell").
2. **Apply runtime `sound-mood` overlay** at the element level — use one of the 9 built-in moods. Use this when the prompt describes a global UI vibe ("retro app").

Prefer (1) for one-off custom presets; recommend (2) when the user describes a global aesthetic.

#### Conflict resolution

- `warm` + `bright` → later token wins.
- `punchy` + `airy` → orthogonal (envelope vs source); both apply.
- `lofi` + `glassy` → only one mood at a time, prefer the stronger word in context.
