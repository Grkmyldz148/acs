---
title: Pick a base layer from the prompt's event class
impact: CRITICAL
impactDescription: Sets the entire shape of the output; the wrong base layer means starting from scratch later.
tags: pipeline, base-layer
prompt: ""
example: |
  /* If prompt = "soft pop on click",
   * agent picks event-click as base, ready for mood-soft (a synonym of mood-airy). */
---

## Pick a base layer from the prompt's event class

Tokenize the prompt; find the strongest match against the event-rule token map (see SKILL.md §1.2).
The chosen rule's `example` is your starting `@sound`.

#### Direction tokens (open vs close)

- "open", "appear", "in", "show", "expand", "confirm" → ascending pitch via `pitch-from <low> to <high>`.
- "close", "dismiss", "out", "hide", "collapse", "cancel" → descending pitch.

When two event classes both fire (e.g. "modal close error"), pick the more specific one
(here: `event-error` plus `room: small-room` from the modal context, not `event-modal-close`).

If no class fires confidently, default to `event-click` and let mood adjectives do the work.
