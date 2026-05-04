---
title: Click — sine + low FM, very short decay
impact: HIGH
impactDescription: Default click sound; the most-used base layer.
tags: event, click, transient
prompt: "click button press"
example: |
  @sound my-click {
    body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.22; }
  }
---

## Click — sine + low FM, very short decay

A short sine with light FM. The FM adds subtle harmonic body without making it metallic; the very short decay (10–20 ms) keeps the sound feeling like a tap rather than a chime.

**Incorrect** (decay too long — sounds like a chime):

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; decay: 0.5s; gain: 0.18; }
}
```

**Correct:**

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.22; }
}
```

Reference: `poc/defaults.acs` → `@sound click`, `@sound click-soft`.
