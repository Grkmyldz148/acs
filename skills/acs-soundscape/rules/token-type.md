---
title: Map typography to acoustic texture
impact: HIGH
impactDescription: Type is the most-touched visual surface; matching its grain and weight in sound is half the identity work.
tags: token, typography, font
---

## Map typography to acoustic texture

The dominant font family is the strongest texture signal short
of color.

### Family → texture

| Type stack             | Texture analogue           | Sonic implication                                                              |
|------------------------|----------------------------|--------------------------------------------------------------------------------|
| Mono (Berkeley, JetBrains, IBM Plex Mono, system mono) | Mechanical keyboard, line printer | Mechanical click textures fit; sharp transients (1–2 ms attacks); woodblock-adjacent percussion is on-brand; avoid breathy or organic textures |
| Sans (Inter, Helvetica, Söhne)             | Smooth surface         | Clean transients; pure sines OK; minimal noise; medium attacks (3–8 ms)          |
| Display sans (Geist, Satoshi, Untitled Sans) | Confident surface     | Slightly fuller bodies; dual-partial chords for emphasis events                   |
| Serif (Tiempos, GT Sectra, Caslon)         | Paper, ink              | Soft attacks (8–15 ms); papery noise textures; bandpass-filtered noise on swooshes; longer decays acceptable |
| Display serif (Editorial New, Reckless)     | Heavy paper, embossed   | Add subtle saturation tail; lower fundamentals; consider room reverb            |
| Script / handwritten   | Pen, brush               | Organic noise textures; envelope shapes with curves (long attack > short attack); avoid hard transients |
| Display experimental (variable fonts, deformed) | Glitch, distortion | Bitcrush layer acceptable; FM modulation on bodies; non-standard ratios OK     |

### Letter-spacing & weight as modifiers

- **Wide letter-spacing** (>0.05em) on display type → bias toward
  cleaner, more isolated transients (don't pile layers on one tick).
- **Tight letter-spacing** (<-0.02em) → denser attacks acceptable;
  overlapping layers fine.
- **Heavy weight everywhere** (700+) → fuller bodies; lower
  fundamentals OK; longer decays.
- **Light weight everywhere** (<400) → thin sines; short decays;
  no saturation.

### Mixing families

If the project uses one mono + one display serif (a common
editorial-tech split), the soundscape can mirror this by giving
clicks the mono character (mechanical, sharp) and signature
events (page-enter, success) the serif character (papery,
weighted, slightly longer). The split itself becomes part of
the identity.

### What you produce

A line in your token sheet:

```
TYPE: <family character> — <one-line sonic implication>
```

Example: `TYPE: mono everywhere (Berkeley Mono) — mechanical
click textures, 1–2 ms attacks, woodblock percussion fine,
no breathy or organic.`

This constrains your **layer choices** (which primitives to use:
`tones:` for clean, `noise:` for breath, `pluck:` for woody)
in `pipeline-author-customs`.
