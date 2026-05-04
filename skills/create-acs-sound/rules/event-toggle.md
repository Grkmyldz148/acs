---
title: Toggle — paired tones for on/off states
impact: MEDIUM-HIGH
impactDescription: Toggles need state-aware cascade — one for on, one for off.
tags: event, toggle, switch
prompt: "toggle switch on off check uncheck"
example: |
  @sound my-toggle-on  { body { tones: 880hz;  decay: 80ms; gain: 0.3; } }
  @sound my-toggle-off { body { tones: 660hz;  decay: 80ms; gain: 0.3; } }
  /* In your stylesheet:
   *   [role="switch"]:on-click                          { sound: my-toggle-on; }
   *   [role="switch"][aria-checked="true"]:on-click     { sound: my-toggle-off; }
   */
---

## Toggle — paired tones for on/off states

A single sound for both states feels confusing — the user needs to hear which
direction the toggle moved. Define **two** presets, then use the cascade to
pick by `aria-checked`:

```css
[role="switch"]:on-click                       { sound: my-toggle-on; }
[role="switch"][aria-checked="true"]:on-click  { sound: my-toggle-off; }
```

The second selector has higher specificity (extra attribute) so it wins when
the switch is currently ON (about to turn OFF). The first matches when OFF
(about to turn ON).

**Pitch direction**: ON should be higher than OFF — universal "rising = activating".

Reference: `poc/defaults.acs` → `@sound toggle-on`, `@sound toggle-off`.
