---
title: Map copy tone to mood overlays and volume
impact: MEDIUM-HIGH
impactDescription: The copy is the project speaking out loud. The soundscape's mood must match what the words sound like.
tags: token, copy, voice, mood
---

## Map copy tone to mood and volume

The hero tagline, button labels, and footer copy reveal the
brand's voice. A soundscape that doesn't match the voice feels
like a stranger has dubbed the site.

### Copy voice → mood overlay & global volume

| Copy voice                                        | Example labels                | Mood overlay (if any)            | Master volume |
|---------------------------------------------------|-------------------------------|----------------------------------|---------------|
| Terse, technical, dry, dev-targeted               | "Run", "Compile", "Deploy"   | none, or `metallic` if mono type | 0.45–0.55     |
| Editorial, considered, prose-heavy                | "Read on", "Continue", "Subscribe" | `warm` or `organic`         | 0.50–0.60     |
| Confident, declarative                             | "Get started", "Try it free", "Watch demo" | none — let the customs speak | 0.55–0.65 |
| Warm, friendly, vocative                           | "Say hi", "Let's chat", "Welcome" | `warm` + slight `airy`         | 0.55–0.65     |
| Playful, witty, irreverent                         | "Boop!", "Yeet", "Just do it (literally)" | `bright` + `punchy`         | 0.60–0.70     |
| Brutalist, manifesto-loud, anti-corporate          | "WE REJECT", "NO MORE", "RAW" | `lofi` + saturation               | 0.70–0.85     |
| Luxury, restrained, third-person                   | "An invitation", "A study in"  | `glassy` (sparingly)             | 0.40–0.55     |
| Clinical, scientific, formal                       | "Initiate analysis", "Submit specimen" | none, very dry              | 0.40–0.50     |
| Childlike, whimsical                               | "Tap me!", "Yay!"             | `bright` + `airy`                | 0.55–0.65     |

### Mood overlays in ACS

Mood overlays are applied in `:root` or on specific scopes:

```
:root { sound-mood: warm; }        /* whole page sounds warm */
[data-section="hero"] { sound-mood: bright; }  /* but hero is bright */
```

They are **not** applied per `@sound`. They live in the
cascade. Use them sparingly — one global mood plus at most one
scoped override is plenty. Three moods stacked become noise.

### Punctuation as a tell

| Punctuation pattern in copy   | Implication                                          |
|-------------------------------|------------------------------------------------------|
| Lots of periods, terminal sentences | Snap, brief, no overlap on bindings              |
| Em-dashes everywhere          | Slightly longer decays acceptable; comma-rhythm OK    |
| Exclamation points           | Allow `+1st` pitch lift on primary actions           |
| All-lowercase                 | Quieter master volume; intimate                      |
| ALL-CAPS HEROES               | Louder master volume (0.65+); unapologetic           |
| Heavy formatting (**, *, `)   | Pluralize on signatures — multi-layer chords work     |

### What you produce

Two lines in your token sheet:

```
COPY.voice: <description>  →  master-volume <number>
COPY.mood:  <overlay or "none">  +  scoped override on <selector if any>
```

Example: `COPY.voice: terse, dev-targeted, no exclamation points
→ master-volume 0.50. COPY.mood: none — let the custom presets
carry the identity.`

This sets `master-volume` and decides whether you need a
`sound-mood` declaration in `:root` or any scope.
