---
title: Modal open — ascending sweep with small-room reverb
impact: HIGH
impactDescription: Spatial cue — "something came forward". Reverb is part of the identity.
tags: event, modal, open, ascending, reverb
prompt: "modal dialog popup drawer sheet open appear show expand"
example: |
  @sound my-modal-open {
    body { osc: sine; freq: 440hz; pitch-from: 440hz to 660hz; decay: 0.4s; gain: 0.25; }
  }
  /* Apply at the trigger element:  dialog[open] { sound-on-appear: my-modal-open; room: small-room; } */
---

## Modal open — ascending sweep with small-room reverb

Modals announce a context shift — the user's attention should follow. An ascending
pitch sweep on a sine carrier reads as "rising into focus". Pair with `room: small-room`
on the element so the reverb confirms the spatial intent.

**Don't** bake the reverb into the `@sound` itself. ACS rooms are per-element
properties resolved by the cascade — keeping them separate means the same
preset can sound right in different room contexts.

**Do** keep the carrier sine — square or saw makes the sound feel cheap.
FM (`fm: { ratio: 0.7, depth: 30 }`) adds tasteful body without metallic ring.

Reference: `poc/defaults.acs` → `@sound modal-open`, `@sound drawer-open`, `@sound page-enter`.
