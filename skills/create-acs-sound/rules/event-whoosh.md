---
title: Whoosh — wider, slower swoosh variant
impact: MEDIUM
impactDescription: Larger transitions (full-page nav, dramatic reveals) want a slower swoosh.
tags: event, whoosh, transition, noise
prompt: "whoosh dramatic reveal hero animation"
example: |
  @sound my-whoosh {
    body {
      noise: pink;
      filter: bandpass; cutoff: 1200hz; q: 1.2;
      pitch-from: 200hz to 4000hz;
      decay: 600ms;
      gain: 0.4;
    }
  }
---

## Whoosh — wider, slower swoosh variant

`whoosh` differs from `swoosh` in two ways: longer decay (400–700 ms vs ~200 ms),
and pink noise instead of white (warmer texture, less "hiss"). Use whoosh for
hero animations, page-level reveals, modal entries that need drama.

**Don't** chain a whoosh with another sound on close-following events —
the long tail will collide.

Reference: `poc/defaults.acs` → `@sound whoosh`.
