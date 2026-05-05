---
title: Verify presets honor the token sheet
impact: HIGH
impactDescription: The token sheet is meaningless if the authored presets ignore it. This validator closes the loop.
tags: validate, tokens, fit
---

## Verify presets honor the token sheet

`pipeline-extract-tokens` produced a token sheet with explicit
constraints (frequency bands, attack caps, decay caps, room).
Before shipping, verify each custom `@sound` falls inside those
constraints.

### Procedure

For each custom `@sound`:

1. **Frequency:** Pull the body's `freq:` (or `tones:` value, or
   `pitch-from`/`to` range). Is it within `COLOR.body-band`?
   Pull the click layer's `freq:` or `cutoff:`. Is it within
   `COLOR.click-band`?
2. **Attack:** Pull every layer's `attack:`. Is each ≤ the
   `RADIUS` row's max attack?
3. **Decay:** Pull every layer's `decay:`. For click-class
   presets, is each ≤ the `MOTION.duration` row's max click
   decay? For signature presets (page-enter, success), is each
   ≤ the signature decay max?
4. **Room:** Does the binding (or `:root`) honor the
   `SHADOW.scale` row's room recommendation, with appropriate
   per-element overrides?
5. **Mood:** If `COPY.mood` recommended a mood overlay, is it
   declared in `:root` or in a relevant scope?

### Reporting

For each preset, output a one-line PASS or a one-line FAIL with
the specific token row violated:

```
caret-tap     PASS
caret-confirm PASS
caret-power-on FAIL — decay 1200 ms exceeds MOTION.signature-cap of 600 ms
caret-tick    FAIL — body 220 Hz outside COLOR.body-band (800–1400 Hz)
```

### Resolution

For each FAIL, decide:

- **Adjust the preset** to fit the token. This is the default
  resolution.
- **Adjust the token sheet** if you believe the original
  mapping was too narrow (rare; only when the inventory
  itself was wrong).
- **Mark the preset as a deliberate signature outlier** —
  with a comment in the `.acs` file explaining the deviation.
  This is allowed for at most ONE preset per soundscape.

### What you produce

The PASS/FAIL list above, then either an updated `.acs` file
or a directive to revisit the failing presets. No file ships
with a FAIL line still red.
