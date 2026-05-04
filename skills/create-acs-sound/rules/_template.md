---
title: <Short title — appears as the rule's heading in SKILL.md>
impact: HIGH
impactDescription: <One-line WHY this rule exists. Used for build-time priority sort.>
tags: <comma-separated tags, e.g. "event, click, transient">
prompt: "<space-separated trigger tokens; agents match against the user's wording>"
example: |
  @sound my-name {
    body { osc: sine; freq: 440hz; decay: 200ms; gain: 0.4; }
  }
---

## <Short title — same as frontmatter `title`>

One-paragraph rationale: what kind of input triggers this rule, what it produces, what the runtime expects.

**Incorrect** (typical mistake — naming what's wrong helps the agent self-correct):

```css
@sound my-name {
  body { osc: sine; freq: 440hz; decay: 5s; gain: 0.95; }   /* decay too long, gain too hot */
}
```

**Correct:**

```css
@sound my-name {
  body { osc: sine; freq: 440hz; decay: 200ms; gain: 0.4; }
}
```

Reference: `poc/defaults.acs` for canonical preset shapes; `poc/runtime/dsp.js` for what each layer key actually does.
