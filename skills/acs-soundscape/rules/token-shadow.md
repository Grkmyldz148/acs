---
title: Map shadow scale to room and reverb
impact: MEDIUM
impactDescription: Shadow is the visual proxy for depth. Reverb is the auditory proxy. They must agree.
tags: token, shadow, room, reverb
---

## Map shadow scale to room

A site's shadow scale tells you how much **acoustic space** it
expects. A flat site lives in a dry room; a layered site lives
in a small reflective room.

### Shadow scale → :root room

| Shadow scale                                    | Room (`:root` value) | Why                                                              |
|--------------------------------------------------|----------------------|------------------------------------------------------------------|
| None — no `box-shadow`, no `drop-shadow`         | `none`               | Dry, anechoic — nothing in the visual hints at space             |
| Hairline — single subtle shadow on cards (`0 1px 2px rgba(0,0,0,0.05)`) | `none` or `small-room` | Minimal cushion; usually still dry overall                        |
| Soft — multiple cards with `0 4px 12px` style    | `small-room`         | Small acoustic depth; ambient tail acceptable                     |
| Layered — explicit `--shadow-1`/`-2`/`-3` scale, modals with prominent shadow | `small-room` or `medium-room` | Layered depth needs slight reverb to read as depth, not as flatness |
| Dramatic — heavy elevation, glow, blurred backdrops | `medium-room` or `large-room` | The page is theatrical; the sound can be too                      |
| Backdrop-blur (glass UI)                         | `small-room` + `mood: airy` | Glass UI needs an airy mood overlay, not heavy reverb            |

### Per-element overrides

Even on a `small-room` site, **commit events** (button clicks,
form submits) often want `room: none`. The reverb on the page
is for ambience; the click itself wants to feel decisive and
present.

```
:root { room: small-room; }            /* identity ambience */

button:on-click { sound: caret-confirm; room: none; }  /* dry on commit */
```

This is a deliberate, common pattern. Don't override every
binding — just the ones where snap matters more than space.

### What you produce

A line in your token sheet:

```
SHADOW.scale: <description>  →  :root room: <none|small-room|medium-room>
            +  per-element override: <which events want dry>
```

Example: `SHADOW.scale: none anywhere → :root room: none.
No per-element overrides needed.`

Or: `SHADOW.scale: layered (--shadow-sm/md/lg used widely) →
:root room: small-room. Per-element: button clicks and form
submits override to room: none for snap.`

This constrains the room column of every binding.

### Anti-pattern

Adding reverb to a site with no shadow scale "to make it feel
richer" is the same mistake as adding a glass texture to a
brutalist page. Match the visual.
