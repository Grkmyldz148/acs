---
title: Extract design tokens
impact: CRITICAL
impactDescription: The token sheet is the bridge between visual identity and acoustic decisions. Without it you are guessing.
tags: pipeline, tokens, css
---

## Extract design tokens

For each token category the project actually uses, open the
matching `token-*.md` reference file and apply its mapping. Write
down the numeric / categorical decisions; you will hand them to
`pipeline-author-customs` so every preset is grounded.

### Order of operations

1. Read the global CSS files surfaced in `pipeline-inventory`.
2. Pull these tokens (skip what doesn't exist):
   - **Color palette** — primary brand color, background, text.
     Convert to HSL. Note hue, saturation, lightness.
     → open `rules/token-color.md`
   - **Typography** — font families. Mono / serif / sans / display.
     Note line-height and letter-spacing if unusual.
     → open `rules/token-type.md`
   - **Border radius** — the project's default `--radius` or the
     `rounded-*` value used on buttons. Sharp / subtle / rounded / pill.
     → open `rules/token-radius.md`
   - **Motion** — `transition-duration` defaults, easing curves,
     and whether the site uses scroll/parallax animation.
     → open `rules/token-motion.md`
   - **Shadow** — none / hairline / soft / dramatic.
     → open `rules/token-shadow.md`
   - **Copy tone** — from the inventory note's _voice_ field.
     → open `rules/token-copy.md`

### What you produce

A table-style note with each token category and its sonic
implication, e.g.:

```
COLOR    | hue 145°, saturation 80%, lightness 50% — phosphor green on near-black
         → cooler timbre; bias fundamentals to 1.5–3 kHz; thin partials acceptable
TYPE     | mono everywhere (Berkeley Mono); no serif; no sans
         → mechanical click textures fit; transients can be sharp; avoid breathy
RADIUS   | 0px on buttons, 2px on cards (sharp)
         → 1–2 ms attacks; hard transients; no "soft pop" sounds
MOTION   | duration-100 transitions, no parallax, instant scroll
         → short decays (≤ 80 ms on click events); no long tails
SHADOW   | none anywhere
         → dry rooms (`room: none`) on most events; reverb only as a deliberate
           identity choice (e.g. CRT phosphor decay) not an ambience
COPY     | terse, technical, slightly dry humor
         → no celebratory chimes; success sounds should be matter-of-fact
```

This sheet is the brief. Every `@sound` block you author next
must trace back to at least one row.

### Anti-pattern

Listing tokens but ignoring them when authoring. If your token
sheet says "1–2 ms attacks; hard transients" and you write
`attack: 8ms` on the click preset, the soundscape is decoupled
from the visual identity — exactly what this skill exists to
prevent.
