---
title: Validate — duration cap
impact: HIGH
impactDescription: Long UI sounds block follow-on triggers, accumulate, and frustrate users.
tags: validate, duration, decay
prompt: ""
example: |
  /* OK — short tap, well under cap */
  @sound ok-tap { body { tones: 1.4khz; decay: 50ms; gain: 0.4; } }

  /* FAIL — 2.5s decay on a tap is ridiculous */
  @sound bad-tap { body { tones: 1.4khz; decay: 2500ms; gain: 0.4; } }
---

## Validate — duration cap

After emit, compute the sound's total audible duration:

```
duration = max(layer.start + layer.attack + layer.decay + layer.release) for all layers
         + room tail (if room != dry)
```

Then check against the event-class cap:

| Event class                                | Max duration   | Notes                                        |
| ------------------------------------------ | -------------- | -------------------------------------------- |
| click, tap, tick, hover, focus             | 100 ms         | Past this, it's not a tap                    |
| input, keystroke                           | 60 ms          | Strict — repeats compound quickly            |
| toggle, copy                               | 200 ms         | Two layers can stretch to 250 ms             |
| swoosh, page transition                    | 400 ms         | Cinematic feel allows 600 ms                 |
| modal-open, drawer-open                    | 500 ms         | + 400 ms room tail = 900 ms total acceptable |
| notification, mention                      | 700 ms         | Friendly attention; not a song               |
| success, complete, achievement             | 800 ms         | Chord cascade caps here                      |
| error, denied                              | 400 ms         | Don't punish — short sting                   |

#### Why the strict caps

UI sounds compound. If a user clicks 5 buttons in 1 second and each sound is
800 ms long, you're playing 4 sounds simultaneously by the end. The runtime's
voice pool will steal voices, but the user's perception is "the app is
overwhelming".

#### Fix overruns

- **Truncate `decay`** — usually the lowest-impact change.
- **Drop `release`** if present — `decay` alone usually suffices for percussive UI sounds.
- **Reduce `start` offsets** in multi-layer presets — pull layers closer together.
- **Switch `room: hall` → `room: small-room`** — drops 1.6 s of tail.

#### Reverb tail accounting

If the cascade applies a non-`dry` room, add the room's tail (see
`effect-reverb-tail` table) to the layer durations before checking against the
cap. A 200 ms preset in `room: hall` has a 3-second-total acoustic footprint —
that's *fine* for `modal-open` but unacceptable for a `tap`.

Reference: `poc/runtime/voicepool.js`.
