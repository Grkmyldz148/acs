---
title: Write the sonic identity statement
impact: HIGH
impactDescription: Every preset is a test against this statement. Without it the soundscape drifts into incoherence.
tags: pipeline, identity, brief
---

## Write the sonic identity statement

3–4 sentences in plain English describing what an interaction
should _feel_ like. This is the brief every `@sound` block is
graded against.

### Template

```
This site sounds like ___. Interactions should feel ___ rather
than ___. The signature moment is ___ — when the user does ___,
they should hear ___, which echoes the visual ___. Quiet by default;
the soundscape should fade into peripheral hearing within a
two-minute session.
```

### Examples

**Caret** (terminal CLI tool):
> This site sounds like a well-tuned mechanical keyboard plugged into
> a CRT terminal in a quiet room. Interactions should feel _precise
> and immediate_ rather than _bouncy or rewarding_. The signature
> moment is the page enter — when the page mounts, you hear a soft
> phosphor warm-up that fades into silence in 600 ms, echoing the
> visual fade-in of the hero text. Quiet by default; the soundscape
> should fade into peripheral hearing within a two-minute session.

**Editorial publication**:
> This site sounds like leafing through a fresh issue under a
> reading lamp. Interactions should feel _papery and weighted_
> rather than _digital and clicky_. The signature moment is the
> article-open — a soft page-turn whoosh layered over a low
> wooden creak. Quiet by default; the soundscape should fade
> into peripheral hearing within a two-minute session.

**Trading platform**:
> This site sounds like the inside of a vault with steel-on-steel
> latches. Interactions should feel _certain and consequential_
> rather than _playful_. The signature moment is the trade-confirm
> — a single dry metal tap with no reverb, brief enough to not
> interrupt focus. Quiet by default; the soundscape should fade
> into peripheral hearing within a two-minute session.

### Constraint: it must be falsifiable

A bad identity statement: "This site sounds modern and clean."
That describes 90% of websites. Useless.

A good identity statement names the references (mechanical
keyboard / CRT terminal; paper / wood; vault / steel), the
mode (precise; papery; certain), and the negative space (not
bouncy; not digital; not playful). When you author a preset
later, you can test: "does the chord here feel certain or
playful?" — that's only possible if the brief is specific.

### What you produce

The 3–4 sentence statement. Save it; you will quote it in code
comments at the top of the `.acs` file you ship.
