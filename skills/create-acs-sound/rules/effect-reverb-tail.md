---
title: Effect — reverb tail (room property)
impact: HIGH
impactDescription: ACS reverb is per-element, not per-@sound. This rule covers when and how.
tags: effect, reverb, room
prompt: "reverb echo tail room space"
example: |
  /* Reverb is applied via the cascade, not inside the @sound: */
  @sound my-bell { body { tones: 880hz, 1320hz; decays: 0.6s, 0.4s; gain: 0.32; } }

  dialog[open]               { sound-on-appear: my-bell; room: small-room; }
  .ambient-section button    { sound-on-click: my-bell; room: medium-room; }
---

## Effect — reverb tail (room property)

In ACS, reverb is a **per-element** property called `room`. It's not declared
inside `@sound` blocks because the same preset may need different acoustic
contexts (a bell inside a modal sounds different from a bell on the home page).

#### Why per-element?

The runtime maintains lazy convolver chains keyed by room name. First use of
each room instantiates the impulse response; subsequent triggers reuse it.
Decoupling room from preset means:

1. **No duplicated presets** — one `bell` preset used in 5 acoustic contexts.
2. **Cascade resolves** the room — themes can re-skin the entire app's spatial
   feel by setting `:root { room: hall; }`.
3. **Inheritance** — `dialog[open]` setting `room: small-room` automatically
   applies to every sound triggered inside the modal.

#### Room sizes (from `poc/runtime/audio.js`)

| Room          | Tail (s) | Use case                                |
| ------------- | -------- | --------------------------------------- |
| `dry`         | 0        | Default; bypasses convolver entirely    |
| `small-room`  | 0.4      | Modals, taps, intimate alerts           |
| `medium-room` | 0.9      | Default for most apps                   |
| `large-room`  | 1.6      | Concert / cinematic feel                |
| `hall`        | 2.8      | Long, lush ambient — page transitions   |
| `plate`       | 1.2      | Dattorro plate reverb — classic studio  |

#### When the agent should add a `room`

- The user's prompt contains "reverb", "echo", "tail", "room", "space".
- The base `@sound` is for an event class that idiomatically benefits from
  reverb: `event-modal-open`, `event-page-enter`, `event-notification`.
- The user describes a specific environment ("cathedral" → `hall`,
  "studio" → `plate`).

#### When NOT to add reverb

- Tap / click / tick events — the tail muddles the transient.
- Error events — reverb softens urgency, defeats the purpose.
- High-frequency tinkles (sparkle, bell-bright) where the convolver IR's
  early reflections clash with the source's brightness.

Reference: `poc/runtime/audio.js` → `getDest()`.
