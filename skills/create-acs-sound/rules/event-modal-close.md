---
title: Modal close — descending sweep, mirror of modal-open
impact: HIGH
impactDescription: Closes the spatial loop opened by modal-open.
tags: event, modal, close, descending
prompt: "modal dialog close dismiss out hide collapse cancel"
example: |
  @sound my-modal-close {
    body { osc: sine; freq: 660hz; pitch-from: 660hz to 440hz; decay: 0.3s; gain: 0.22; }
  }
---

## Modal close — descending sweep, mirror of modal-open

Symmetric to `event-modal-open` but with descending pitch and slightly shorter decay.
The asymmetry (closing should be faster than opening) makes the close feel responsive
rather than ceremonial.

**Pair with** the same `room: small-room` applied to modals — close inherits the
acoustic context.

Reference: `poc/defaults.acs` → `@sound modal-close`, `@sound drawer-close`, `@sound dropdown-close`.
