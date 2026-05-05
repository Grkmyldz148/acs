---
title: Map motion to envelope length
impact: MEDIUM-HIGH
impactDescription: Sound and motion are felt as one event. A 350 ms decay on a 100 ms transition feels laggy.
tags: token, motion, decay
---

## Map motion to envelope length

Find the project's default `transition-duration` and the easing
curves it uses. These tell you how long a sound is allowed to
last before it disconnects from the visual it accompanies.

### Transition duration → max decay

| transition-duration | Site mood | Max decay (click events) | Max decay (signature events) |
|---------------------|-----------|--------------------------|-----------------------------|
| 0 / instant         | No-nonsense, brutalist | 30 ms        | 200 ms                      |
| 75–100 ms           | Snappy, dev-tool       | 60 ms        | 300 ms                      |
| 150–200 ms (default modern) | Balanced     | 100 ms       | 400 ms                      |
| 250–350 ms          | Considered, editorial   | 150 ms       | 600 ms                      |
| 400–600 ms          | Languid, luxury         | 200 ms       | 1000 ms                     |
| Animations (multi-second) | Cinematic, hero  | Per-event design       | Per-event design          |

Sound decay should be ≤ visual transition. Otherwise the user's
ear is still processing the event after the screen has settled —
laggy.

### Easing curve → envelope shape

| Easing                  | Envelope shape                                          |
|-------------------------|---------------------------------------------------------|
| `linear`                | Linear-ish decay; no exponential tail                    |
| `ease-out` / `cubic-bezier(0, 0, 0.2, 1)` | Standard exponential decay (default)            |
| `ease-in`               | Long-tail decay; the head is quiet, the tail is the event |
| `ease-in-out`           | Slight bell-shape; longer attack permitted               |
| `cubic-bezier` with overshoot (springy) | Add a brief secondary tap after the main hit       |
| `steps()` / no easing   | Hard envelope, no smoothing on attack or release         |

### Scroll behavior

| Scroll style                | Implication                                                      |
|-----------------------------|------------------------------------------------------------------|
| Default browser             | Section-reveal sounds OK if quiet (≤ 0.2 volume)                  |
| `scroll-behavior: smooth`   | Section-reveal sounds at slightly higher volume; soft transitions |
| Parallax / scroll-jacking   | Continuous scroll texture acceptable; consider rumble or wind       |
| Snap-scroll between sections| One-shot snap sound on each section reveal — make it punchy        |
| No scroll-driven animation  | Skip scroll-triggered sounds entirely; the page doesn't want them   |

### What you produce

Two lines in your token sheet:

```
MOTION.duration: <ms>ms — max click decay <ms>, max signature decay <ms>
MOTION.easing:   <curve> — envelope shape: <description>
```

Example: `MOTION.duration: 100 ms — max click decay 60 ms, max
signature decay 300 ms. MOTION.easing: cubic-bezier(0,0,0.2,1)
— standard exponential.`

This constrains every preset's `decay:` decision in
`pipeline-author-customs`.
