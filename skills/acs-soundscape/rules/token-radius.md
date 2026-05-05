---
title: Map border-radius to attack & transient shape
impact: MEDIUM-HIGH
impactDescription: A page with sharp corners and soft, bouncy clicks reads as off-brand.
tags: token, radius, attack
---

## Map border-radius to attack shape

Find the project's primary `--radius` (or the value used on
buttons / cards in the global CSS / Tailwind config). One number
is enough.

### Radius → attack & transient

| Radius (px)     | Visual character | Click attack | Body attack | Transient                 |
|-----------------|------------------|--------------|-------------|---------------------------|
| 0               | Brutalist sharp  | 0.3–1 ms     | 1–2 ms      | Hard, almost a "step"     |
| 1–3             | Sharp            | 0.5–1.5 ms   | 1–3 ms      | Crisp, no rounding        |
| 4–8             | Subtle round     | 1–2 ms       | 3–6 ms      | Standard tap              |
| 9–14            | Rounded (default modern SaaS) | 1–3 ms | 5–10 ms | Cushioned tap             |
| 15–24           | Soft pillow      | 2–5 ms       | 8–15 ms     | Pop or small bounce       |
| 25+ / pill      | Highly rounded   | 3–8 ms       | 10–20 ms    | Bubble, water-drop        |
| 9999 (full)     | Pill, app-store  | 4–10 ms      | 12–25 ms    | Almost vocal "bup"        |

The mapping is intuitive: hard corners = hard transients; soft
corners = soft transients. Cross-cutting this (sharp click on
pill button) creates dissonance — the user feels something is
"off" without knowing why.

### Mixed radii

Sites that use 0px on buttons + 16px on cards are common: the
buttons want decisive sharp clicks, the cards want softer
ambient sounds. Use the radius that applies to the **specific
element** being bound.

### What you produce

A line in your token sheet:

```
RADIUS: <number>px — attacks ≤ <max ms>, transient character: <description>
```

Example: `RADIUS: 0px on buttons — attacks ≤ 1.5 ms, hard
step-edge transients, no soft pop.`

This constrains every preset's `attack:` decision. If a
later preset has `attack: 8ms` on a 0-radius button binding,
the validator catches the mismatch.
