---
title: Map color palette to acoustic parameters
impact: HIGH
impactDescription: Color is the loudest visual signal of mood; ignoring it produces a soundscape that fights the page.
tags: token, color, hsl
---

## Map color palette to acoustic parameters

Convert each significant color to HSL. Then read the H, S, and L
columns below to pick parameter ranges. The dominant brand color
gets the most weight; background and text colors modulate.

### Hue → frequency band & timbre

| Hue range (HSL H°) | Family    | Body fundamental | Click fundamental | Partial character        |
|--------------------|-----------|------------------|-------------------|--------------------------|
| 0–25, 340–360 (red)| Hot       | 220–500 Hz       | 1.5–3 kHz         | dense, slight saturation |
| 25–55  (orange)    | Warm      | 350–700 Hz       | 2–4 kHz           | dense, bright            |
| 55–95  (yellow/lime)| Bright   | 500–900 Hz       | 3–6 kHz           | thin, sparkling          |
| 95–155 (green)     | Organic   | 200–600 Hz       | 1.5–4 kHz         | natural, woody acceptable|
| 155–200 (teal/cyan)| Cool      | 400–900 Hz       | 2–5 kHz           | thin, glassy             |
| 200–250 (blue)     | Cold      | 500–1200 Hz      | 2–4 kHz           | clean, narrow partials   |
| 250–290 (purple)   | Refined   | 300–700 Hz       | 1.5–3 kHz         | bell-like, slight FM     |
| 290–340 (magenta)  | Synthetic | 400–900 Hz       | 2.5–5 kHz         | bright, chord-friendly   |

For grayscale palettes (S < 10%), pick the family from the
**accent** color or the project's photography mood.

### Saturation → harmonic richness

| Saturation | Effect on partials                                            |
|-----------|---------------------------------------------------------------|
| 0–20%     | Use only fundamentals; minimize `ratios:` lists; pure sines    |
| 20–55%    | Two partials max; gentle ratios (1, 2, or 1, 2.4)              |
| 55–80%    | Three to four partials; classic ratios; some saturation OK     |
| 80–100%   | Dense partials; FM modulation acceptable; brighter filters     |

Highly saturated palettes (>80%) almost always come with bold
copy and big motion — match that with rich harmonic content.

### Lightness (background) → noise floor & body weight

| Background lightness | Implication                                              |
|---------------------|----------------------------------------------------------|
| 0–15% (near-black)  | Body fundamental can sit lower (200–500 Hz); long decays acceptable; minimal noise |
| 15–40% (dark)       | Mid-range bodies (300–700 Hz); medium decays              |
| 40–70% (mid)        | Higher bodies (500–1200 Hz); short decays                 |
| 70–95% (light)      | Click-dominated; bodies optional and quiet; very short decays|
| 95–100% (paper)     | Bright clicks 2–5 kHz; bodies almost absent; decays ≤ 80 ms |

A near-black site with a sharp 3 kHz click on white-noise
background sounds like a lab instrument. The same click on a
paper-white site sounds like cutlery. Match the floor.

### What you produce

Three lines in your token sheet:

```
COLOR.body-band:  <freq range> Hz   from hue <H°> + lightness <L%>
COLOR.click-band: <freq range> Hz   from hue <H°>
COLOR.partials:   <description>     from saturation <S%>
```

These bands constrain every preset's `freq:` decisions in
`pipeline-author-customs`. If a preset's `freq:` falls outside
the band without a written reason, you've drifted.
