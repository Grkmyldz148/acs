---
title: Success — ascending major-third chord
impact: HIGH
impactDescription: Positive confirmation; the chord shape carries "things went right".
tags: event, success, chord
prompt: "success complete confirm done win achievement"
example: |
  @sound my-success {
    body  { tones: 880hz, 1108hz; decay: 0.5s; gain: 0.3; }
    sweet { tones: 1320hz; start: 80ms; decay: 0.4s; gain: 0.25; }
  }
---

## Success — ascending major-third chord

Two layers on staggered `start` times produce an ascending major chord (root + third + fifth).
880 Hz / 1108 Hz / 1320 Hz is approximately A5 / C#6 / E6 — a clean, hopeful sound.

**Use staggered `start`** to spell out the chord rather than play it as a solid block.
First two tones together (root + third), then the fifth slightly delayed.

If the prompt says "subtle success" or "quiet confirm", drop gains to 0.15 and shorten decays.

Reference: `poc/defaults.acs` → `@sound success`, `@sound complete`.
