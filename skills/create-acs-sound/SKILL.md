---
name: create-acs-sound
description: Generate an ACS @sound block from a natural-language prompt, an audio file, or both. Use when the user says "create a sound", "/create-acs-sound", "design a sound for X", shares a WAV/MP3, or asks to reverse-engineer a sample. Optionally renders a WAV preview and round-trip-validates the result.
---

# Create ACS Sound

> Auto-generated from `rules/*.md` by `src/build.mjs`. Do not edit by hand.

Pick a generation path with `pipeline-detect-input`, then walk the matching section.

## 1. Generation Pipeline

_Procedural steps the agent runs end-to-end. Start here when handling any create-acs-sound request._

### 1.1 Detect input mode and route the request _(CRITICAL)_

Decide which path to run based on what the user provided.

| Input                                    | Path                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Prompt only (no audio attachment)        | Skip `interpret-*`. Go to `pipeline-pick-base-layer`.                       |
| Audio file only                          | Run all `interpret-*` rules. Skip `event-*` / `mood-*`.                     |
| Both prompt and audio                    | Run `interpret-*` first, then treat prompt as a refinement on the measured `@sound`. |

#### Detecting audio

Look for attached files matching `*.wav`, `*.mp3`, `*.flac`, `*.ogg`, or any path the user references that resolves to an audio file.

#### Refinement examples (prompt + audio)

| Prompt qualifier           | Refinement on measured definition                            |
| -------------------------- | ------------------------------------------------------------ |
| "warmer"                   | add `filter: lowpass; cutoff: 2500hz` to body layer          |
| "shorter" / "punchier"     | clamp `decay <= 60ms`                                         |
| "brighter"                 | drop or raise any lowpass cutoff                              |
| "with reverb"              | add `room: small-room` (or `medium-room`) at element level    |
| "lower octave"             | halve `freq` (or both `pitch-from start/end`)                 |

#### Output of this step

Produce an internal note like:

```
Input: prompt + audio
Plan: run interpret-* on out/click.wav, then refine with mood-warm.
```

Then proceed to the next pipeline step.

### 1.2 Pick a base layer from the prompt's event class _(CRITICAL)_

Tokenize the prompt and find the strongest event-class signal. Match against the `event-*` rules.

#### Token map

| Tokens in prompt                                              | Event rule                              |
| ------------------------------------------------------------- | --------------------------------------- |
| click, tap, key, press, button                                | `event-click` / `event-tap`              |
| tick, scroll, snap, focus                                     | `event-tick`                             |
| success, complete, win, achievement, level-up, confetti       | `event-success` / `event-complete`       |
| error, fail, wrong, invalid, delete, destroy                  | `event-error`                            |
| modal, dialog, popup, drawer, sheet, sidebar, dropdown, menu  | `event-modal-open` / `event-modal-close` |
| swoosh, slide, transition, page, tab                          | `event-swoosh` / `event-whoosh`          |
| notification, alert, ding, bell, mention, badge               | `event-notification`                     |
| toggle, switch, on, off                                       | `event-toggle`                           |

#### Direction tokens (open vs close)

- "open", "appear", "in", "show", "expand", "confirm" → ascending pitch (use `pitch-from <low> to <high>`).
- "close", "dismiss", "out", "hide", "collapse", "cancel" → descending pitch.

#### Output

A starting `@sound` literal copied from the chosen event rule's `example`. The next step (`pipeline-apply-mood`) will mutate it.

If no event class fires confidently, default to `event-click` and let mood adjectives do the work.

### 1.3 Apply mood adjectives onto the base layer _(HIGH)_

After `pipeline-pick-base-layer` produces a starting `@sound`, scan the prompt for adjective tokens and apply each `mood-*` rule's mutation in order.

#### Order of application

1. **Source-shape adjectives** (`warm`, `bright`, `glassy`, `metallic`, `lofi`, `retro`, `organic`) — mutate source layer (e.g., add `filter`, change `osc` waveform, add `fm`).
2. **Envelope adjectives** (`punchy`, `airy`) — mutate `attack` / `decay`.
3. **Effect adjectives** (`reverby`, `delayed`, `crushed`) — append to per-element `room` declaration on the rule that uses the `@sound`.

#### Two paths to apply mood

ACS has **two** ways to apply a mood:

1. **Bake it into the @sound itself** — adjust the layer source/envelope/filter directly. Use this when the prompt's adjective is part of the sound's identity ("a warm bell").
2. **Apply the runtime `sound-mood` overlay** at the element level — use one of the 9 built-in moods. Use this when the prompt describes a *vibe* the entire UI should have ("retro app").

Prefer (1) for one-off custom presets; recommend (2) when the user describes a global aesthetic.

```css
/* Path (1): bake into the @sound */
@sound my-warm-bell {
  body { tones: 880hz; decay: 0.6s; filter: lowpass; cutoff: 2500hz; gain: 0.4; }
}

/* Path (2): rely on sound-mood overlay */
.retro-app { sound-mood: lofi; sound-mood-mix: 0.6; }
@sound my-bell { body { tones: 880hz; decay: 0.6s; gain: 0.4; } }
```

#### Conflict resolution

- `warm` + `bright` → the later token wins.
- `lofi` + `glassy` → emit both as a stacked `sound-mood` only if `sound-mood-mix` is below 1; otherwise pick whichever is stronger in the prompt.
- `punchy` + `airy` → orthogonal (envelope vs source); both apply.

### 1.4 Decide single-layer vs multi-layer _(MEDIUM-HIGH)_

| Event class                                | Default                                       |
| ------------------------------------------ | --------------------------------------------- |
| click, tap, tick, hover, focus, swoosh     | 1 layer (`body` only)                          |
| toggle, copy, send, sync                   | 2 layers (paired pitches with `start` offsets) |
| success, complete, level-up, confetti      | 3+ layers (chord with cascading `start`)       |
| error, delete                              | 2 layers (`osc: sawtooth` + `noise: white`)    |
| any "click + body" archetype               | 2 layers (`body` + `click`)                    |

See `layer-single`, `layer-octave-pair`, `layer-ascending-chord`, `layer-click-plus-body` for concrete shapes.

#### Per-layer gain budget

Sum of `gain` values across layers should be ≤ 0.6 to leave headroom before the runtime calibrator. See `validate-gain-budget`.

#### Naming convention for layer keys

ACS doesn't enforce layer-key names — they're just identifiers within an `@sound`. Conventions:

- `body` — the tonal core (always present)
- `click` — sharp transient noise burst layered on top
- `snap` — short osc/noise stinger
- `ping`, `tail`, `noise` — additional voicings

### 1.5 Emit, optionally render, optionally round-trip _(HIGH)_

#### 1. Emit

Always return a paste-ready ACS snippet:

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.18; }
}
```

Plus a one-line rationale that names the prompt tokens you acted on:

> "click" → base from `event-click`; "warm" → kept default sine, no extra filter needed at 1.3 kHz.

#### 2. Optional preview render

If the user asked for a WAV (or you want to grade your own output), use `analyzer/render.mjs` from the parent repo:

```bash
node analyzer/render.mjs my-click --out preview.wav --duration 0.3
```

`duration` should be `attack + decay + release + 0.05` (small tail) or longer if `room` is set.

#### 3. Optional round-trip validation

If you generated from a prompt and want to confirm the result matches intent, run the `interpret-*` rules against the rendered WAV and diff measured vs intended values:

| Field             | Acceptable drift                            |
| ----------------- | ------------------------------------------- |
| Fundamental Hz    | ±5%                                         |
| Attack            | ±2 ms                                       |
| Decay             | ±10%                                        |
| Spectral centroid | ±20% of expected for the chosen waveform    |

If drift exceeds tolerance, refine the definition (often by raising/lowering `gain`, tightening `decay`, or adjusting `cutoff`) and render again.

## 2. Audio Interpretation

_FFT analysis sub-steps that fire when the user shares an audio file. See the individual `interpret-*` rules in `rules/` for the analysis code._

### 2.1 Acquire and split source audio

The user shared a single file or a sprite (one file containing many sounds). Before any FFT work, get one mono WAV per sound on disk.

For a sprite with a manifest:

```bash
ffmpeg -i sprite.mp3 \
  -ss <start_seconds> -t <duration_seconds> \
  -acodec pcm_s16le -ar 44100 \
  out/<name>.wav
```

For a sprite without a manifest, use silence detection:

```bash
ffmpeg -i sprite.mp3 -af silencedetect=noise=-40dB:d=0.05 -f null -
```

Read the `silence_start` / `silence_end` lines and slice between gaps.

### 2.2 Run interpret-* rules in sequence

| Step                            | Rule                              | Output                                               |
| ------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Extract source type             | `interpret-extract-source`        | One of `tones / modal / osc / pluck / noise`          |
| Extract fundamental & sweep     | `interpret-extract-fundamental`   | `freq: <Hz>` or `pitch-from <Hz> to <Hz>`             |
| Extract envelope                | `interpret-extract-envelope`      | `attack`, `decay`, `release` (ms)                     |
| Classify waveform               | `interpret-classify-waveform`     | `sine / triangle / square / sawtooth` (when osc)      |
| Detect filter                   | `interpret-detect-filter`         | `filter: lowpass / highpass / bandpass; cutoff: <Hz>` |
| Detect effects (reverb, delay)  | `interpret-detect-effects`        | `room: small-room / medium-room / large-room / hall`  |
| Detect LFO modulation           | `interpret-detect-lfo`            | `fm: { ratio, depth }` or detune                       |
| Detect multi-layer              | `interpret-multi-layer`           | Promote to multi-layer `@sound` if necessary          |

### 2.3 Synthesize the @sound block

Combine all `interpret-*` outputs into a single `@sound` block. Layer-key naming follows the convention from `pipeline-decide-layering`. If the audio is clearly multi-layered (separate transient + body), emit `body` + `click` (or named layers).

## 3. Authoring rules

When you encounter a sound class not covered by an existing `event-*` rule, **author a new rule**. Steps:

1. Copy `rules/_template.md` → `rules/event-<your-class>.md` (or `mood-*`, `layer-*`, etc).
2. Fill in frontmatter: `title`, `impact`, `tags`, `prompt`, `example`.
3. Run `node src/build.mjs` to regenerate `SKILL.md`.
4. Run `node src/validate.mjs` to check syntax.

### Frontmatter contract

Every rule must declare:

```yaml
---
title: <short title — appears in the rule's heading>
impact: CRITICAL | HIGH | MEDIUM-HIGH | MEDIUM | LOW
impactDescription: <one-line WHY this rule exists>
tags: <comma-separated tags, e.g. "event, click, transient">
prompt: <space-separated trigger tokens, e.g. "click tap press">
example: |
  @sound name {
    body { ... }
  }
---
```

## Reference

- ACS runtime source: `poc/runtime/`
- Built-in 49 presets: `poc/defaults.acs` (use these names in `sound:` declarations)
- Layer primitives reference: `skills/create-acs-sound/rules/layer-*.md`
- Linter (catches typo'd preset names): `tools/lint-acs.mjs`
- Audition any preset in VSCode: ▶ CodeLens above the `@sound` line


## 4. Event base layers

_Pick exactly one based on the prompt's strongest event-class signal._

### `event-click` _(HIGH)_

> Default click sound; the most-used base layer.


_tags_: `event, click, transient`
A short sine with light FM. The FM adds subtle harmonic body without making it metallic; the very short decay (10–20 ms) keeps the sound feeling like a tap rather than a chime.

**Incorrect** (decay too long — sounds like a chime):

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; decay: 0.5s; gain: 0.18; }
}
```

**Correct:**

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.22; }
}
```

Reference: `poc/defaults.acs` → `@sound click`, `@sound click-soft`.

**Example:**

```css
@sound my-click {
  body { osc: sine; freq: 1300hz; fm: { ratio: 0.5, depth: 60 }; decay: 12ms; gain: 0.22; }
}
```

---

### `event-error` _(HIGH)_

> Negative feedback. Must be unmistakable but not punishing.


_tags_: `event, error, descending, dissonant`
A sawtooth carries the fundamental dissonance; a bandpass-filtered noise layer
adds the "rasp" that makes it read as wrong. The descending pitch sweep
(via `pitch-from`) is the universal "things going down" cue.

**Don't** make errors loud — `gain ≤ 0.4` total. Loud errors feel punishing,
which makes users avoid your app.

**Don't** add reverb to errors — the tail muddles the urgency.
Use `room: dry` (the default) or omit `room` entirely.

If the prompt says "soft error" or "polite warning", swap sawtooth for triangle
and drop the noise layer.

Reference: `poc/defaults.acs` → `@sound error`, `@sound denied`, `@sound buzz`.

**Example:**

```css
@sound my-error {
  body  { osc: sawtooth; freq: 440hz; pitch-from: 440hz to 220hz; decay: 250ms; gain: 0.25; }
  rasp  { noise: white; filter: bandpass; cutoff: 600hz; q: 4; decay: 180ms; gain: 0.15; }
}
```

---

### `event-modal-close` _(HIGH)_

> Closes the spatial loop opened by modal-open.


_tags_: `event, modal, close, descending`
Symmetric to `event-modal-open` but with descending pitch and slightly shorter decay.
The asymmetry (closing should be faster than opening) makes the close feel responsive
rather than ceremonial.

**Pair with** the same `room: small-room` applied to modals — close inherits the
acoustic context.

Reference: `poc/defaults.acs` → `@sound modal-close`, `@sound drawer-close`, `@sound dropdown-close`.

**Example:**

```css
@sound my-modal-close {
  body { osc: sine; freq: 660hz; pitch-from: 660hz to 440hz; decay: 0.3s; gain: 0.22; }
}
```

---

### `event-modal-open` _(HIGH)_

> Spatial cue — "something came forward". Reverb is part of the identity.


_tags_: `event, modal, open, ascending, reverb`
Modals announce a context shift — the user's attention should follow. An ascending
pitch sweep on a sine carrier reads as "rising into focus". Pair with `room: small-room`
on the element so the reverb confirms the spatial intent.

**Don't** bake the reverb into the `@sound` itself. ACS rooms are per-element
properties resolved by the cascade — keeping them separate means the same
preset can sound right in different room contexts.

**Do** keep the carrier sine — square or saw makes the sound feel cheap.
FM (`fm: { ratio: 0.7, depth: 30 }`) adds tasteful body without metallic ring.

Reference: `poc/defaults.acs` → `@sound modal-open`, `@sound drawer-open`, `@sound page-enter`.

**Example:**

```css
@sound my-modal-open {
  body { osc: sine; freq: 440hz; pitch-from: 440hz to 660hz; decay: 0.4s; gain: 0.25; }
}
/* Apply at the trigger element:  dialog[open] { sound-on-appear: my-modal-open; room: small-room; } */
```

---

### `event-notification` _(HIGH)_

> Should attract attention without urgency. Most-overused UI sound; get it right.


_tags_: `event, notification, bell, alert`
A bell archetype: a body of two harmonically-related sines (root + perfect fifth)
plus a higher modal "ping" that gives the sound a clear ring. Decays are layered
so the upper partials die first — exactly how a real bell behaves.

**Don't** use `osc: square` or `osc: sawtooth` for notifications — they read as
electronic alerts (think old phone-system).

**Do** keep total gain under 0.5 — notifications should be friendly, not alarming.
For higher-priority alerts, layer in a third tone (1.32 kHz × 1.5 = 1.98 kHz) rather than
boosting gain.

If the prompt says "subtle notification" or "quiet ping", drop to a single layer
(`@sound ping` from defaults).

Reference: `poc/defaults.acs` → `@sound notify`, `@sound mention`, `@sound badge`, `@sound chime`.

**Example:**

```css
@sound my-notify {
  body { tones: 880hz, 1320hz; decays: 0.5s, 0.35s; gain: 0.32; }
  ping { osc: sine; freq: 1760hz; start: 60ms; decay: 0.25s; gain: 0.18; }
}
```

---

### `event-success` _(HIGH)_

> Positive confirmation; the chord shape carries "things went right".


_tags_: `event, success, chord`
Two layers on staggered `start` times produce an ascending major chord (root + third + fifth).
880 Hz / 1108 Hz / 1320 Hz is approximately A5 / C#6 / E6 — a clean, hopeful sound.

**Use staggered `start`** to spell out the chord rather than play it as a solid block.
First two tones together (root + third), then the fifth slightly delayed.

If the prompt says "subtle success" or "quiet confirm", drop gains to 0.15 and shorten decays.

Reference: `poc/defaults.acs` → `@sound success`, `@sound complete`.

**Example:**

```css
@sound my-success {
  body  { tones: 880hz, 1108hz; decay: 0.5s; gain: 0.3; }
  sweet { tones: 1320hz; start: 80ms; decay: 0.4s; gain: 0.25; }
}
```

---

### `event-tap` _(HIGH)_

> The "satisfying tap" — body gives identity, click gives the snap.


_tags_: `event, tap, click+body`
A tap differs from a click by being slightly longer and having a layered transient.
The `body` carries the pitched character; the `click` adds the high-frequency
snap that tells the ear "I just touched something".

**Use it when** the prompt says "tap", "press", "tactile", "responsive button".

**Don't** add reverb to a tap — the short decay makes any tail muddy.
If the sound needs to feel "in a room", add `room: small-room` at the cascade
level instead of inside the `@sound`.

Reference: `poc/defaults.acs` → `@sound tap`, `@sound tap-tactile`.

**Example:**

```css
@sound my-tap {
  body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
  click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
}
```

---

### `event-tick` _(HIGH)_

> Background micro-feedback for hover, focus, scroll, snap.


_tags_: `event, tick, micro`
A `tick` should be barely-there — high-frequency, very short decay, low gain.
It's the sound a hover/focus/scroll-snap should make: the user feels it more than hears it.

**Don't** use modal or noise sources for ticks — they're too loud at any reasonable gain.
**Do** keep gain ≤ 0.15 and decay ≤ 10 ms. Anything longer becomes a click.

If the prompt says "soft tick" or "subtle tick", lower frequency to ~1.6 kHz and gain to 0.08.

Reference: `poc/defaults.acs` → `@sound tick`.

**Example:**

```css
@sound my-tick {
  body { osc: sine; freq: 2400hz; decay: 6ms; gain: 0.12; }
}
```

---

### `event-complete` _(MEDIUM-HIGH)_

> Long-form success; used for "level up", "unlock", "achievement".


_tags_: `event, complete, chord, ascending`
Three sequential notes spell out a clear ascent. Differ from `event-success`
by being a melodic *phrase* rather than a chord — three discrete tones with
larger `start` offsets (~80–100 ms apart) so the user perceives them as
a sequence, not simultaneity.

**Don't** stack more than 3 notes — past that the user perceives a tune,
which is too prescriptive for a UI sound.

**Do** keep total duration under 600 ms (last `start` + last `decay`),
or the sound starts blocking interaction.

Reference: `poc/defaults.acs` → `@sound complete`.

**Example:**

```css
@sound my-complete {
  n1 { tones: 660hz;  decay: 200ms; gain: 0.25; }
  n2 { tones: 880hz;  start: 90ms;  decay: 220ms; gain: 0.25; }
  n3 { tones: 1320hz; start: 180ms; decay: 280ms; gain: 0.25; }
}
```

---

### `event-toggle` _(MEDIUM-HIGH)_

> Toggles need state-aware cascade — one for on, one for off.


_tags_: `event, toggle, switch`
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

**Example:**

```css
@sound my-toggle-on  { body { tones: 880hz;  decay: 80ms; gain: 0.3; } }
@sound my-toggle-off { body { tones: 660hz;  decay: 80ms; gain: 0.3; } }
/* In your stylesheet:
 *   [role="switch"]:on-click                          { sound: my-toggle-on; }
 *   [role="switch"][aria-checked="true"]:on-click     { sound: my-toggle-off; }
 */
```

---

### `event-swoosh` _(MEDIUM)_

> Page transitions, slide-ins, drawers. Texture, not pitch.


_tags_: `event, swoosh, transition, noise`
A swoosh is a noise burst whose filter cutoff *sweeps* — the agent's job is to
animate the bandpass center frequency from low to high (or vice versa).

`pitch-from` on a noise layer with a bandpass filter shifts the audible band,
producing the "whoosh" effect. Wider sweeps (200 Hz → 5 kHz) feel cinematic;
narrower (1 kHz → 3 kHz) feel like UI page transitions.

**Don't** add tones to a swoosh — it should be texture, not pitch.

**Do** vary `q`: 1.5 = wide (more breath), 4 = narrow (more "laser").

Reference: `poc/defaults.acs` → `@sound swoosh`, `@sound whoosh`.

**Example:**

```css
@sound my-swoosh {
  body {
    noise: white;
    filter: bandpass; cutoff: 1500hz; q: 1.5;
    pitch-from: 800hz to 3000hz;
    decay: 250ms;
    gain: 0.35;
  }
}
```

---

### `event-whoosh` _(MEDIUM)_

> Larger transitions (full-page nav, dramatic reveals) want a slower swoosh.


_tags_: `event, whoosh, transition, noise`
`whoosh` differs from `swoosh` in two ways: longer decay (400–700 ms vs ~200 ms),
and pink noise instead of white (warmer texture, less "hiss"). Use whoosh for
hero animations, page-level reveals, modal entries that need drama.

**Don't** chain a whoosh with another sound on close-following events —
the long tail will collide.

Reference: `poc/defaults.acs` → `@sound whoosh`.

**Example:**

```css
@sound my-whoosh {
  body {
    noise: pink;
    filter: bandpass; cutoff: 1200hz; q: 1.2;
    pitch-from: 200hz to 4000hz;
    decay: 600ms;
    gain: 0.4;
  }
}
```

---


## 5. Mood overlays

_Apply each in `pipeline-apply-mood`'s declared order. Multiple may stack._

### `mood-bright` _(HIGH)_

> Inverse of warm. Adds high-shelf, removes any lowpass that might be present.


_tags_: `mood, brightness, highshelf`
Subtract any existing lowpass; if no filter, leave none. Optionally add a triangle
or square waveform (richer in odd harmonics) and shift the fundamental up by 200–400 Hz.

The runtime `sound-mood: bright` adds a high-shelf boost and (mildly) lifts spectral
centroid — both move the perceived energy upward without changing the perceived note.

**Conflict with warm**: `bright` overrides `warm` if both adjectives appear (later wins).

Reference: `poc/runtime/mood.js` → `MOODS.bright`.

**Example:**

```css
@sound my-bright-tap {
  body { osc: triangle; freq: 1800hz; decay: 60ms; gain: 0.3; }
  /* No filter — bright sounds want all the high content */
}
/* OR */
.bright-zone { sound-mood: bright; }
```

---

### `mood-lofi` _(HIGH)_

> The most-requested aesthetic mood. Combines lowpass + sample-rate reduction + wow/flutter.


_tags_: `mood, lofi, retro, vintage`
The lofi aesthetic combines three ingredients that the runtime overlay applies as a
chain on top of the dry signal:

1. **Lowpass at ~2 kHz** — strips the digital top-end that screams "modern".
2. **Sample-rate reduction to ~16 kHz** — that subtle aliased "buzz" you hear
   in cassette and 80s digital gear.
3. **Wow/flutter LFO** — a 0.5–1.5 Hz sine modulation on pitch (~10 cents depth)
   that mimics tape transport instability.

Baking lofi into a single `@sound` is harder because (2) and (3) are not easily
expressible per-layer. The runtime overlay (`sound-mood: lofi`) is almost always
the right call — apply it on a wrapping element and every sound triggered inside
inherits the treatment.

#### Mix is important

`sound-mood-mix: 1.0` is "full lofi" — heavy and intentional. For most apps that
want a *touch* of lofi (say a creative tool with a vintage UI vibe), use
`sound-mood-mix: 0.4..0.6` so the original sound's clarity isn't lost.

#### Don't combine with

- **`mood: bright`** — the lowpass directly contradicts the high-shelf.
- **`event-error`** — lofi softens the error's urgency, defeats the purpose.

#### Pair well with

- `poc/themes/retro.acs` — the retro theme already biases toward lofi-friendly presets.
- Long decays + `room: plate` — the lofi reverb tail is a recognized aesthetic.

Reference: `poc/runtime/mood.js` → `MOODS.lofi`.

**Example:**

```css
/* Path 1 — runtime overlay (preferred for global aesthetic): */
.lofi-app { sound-mood: lofi; sound-mood-mix: 0.7; }

/* Path 2 — bake into a single @sound: */
@sound my-lofi-tap {
  body {
    tones: 720hz;
    filter: lowpass; cutoff: 1800hz;
    detune: 8;            /* tape wobble approximation */
    decay: 60ms;
    gain: 0.35;
  }
}
```

---

### `mood-punchy` _(HIGH)_

> Transient enhancer + tight gate. Makes sounds feel "tight".


_tags_: `mood, punchy, envelope`
Punchy is fundamentally an envelope thing:
- `attack: 0` — instantaneous onset.
- `decay ≤ 60 ms` — short tail, no lingering.
- `gain` slightly hot (0.35–0.5) — the transient peak is what carries the punch.

The runtime overlay also adds a transient enhancer on the master bus, but baking
the envelope correctly is 80% of the work.

**Don't** stack punchy on already-short sounds — diminishing returns past `decay: 30 ms`.

Reference: `poc/runtime/mood.js` → `MOODS.punchy`.

**Example:**

```css
/* Bake as envelope shape: */
@sound my-punchy-tap {
  body { tones: 1.4khz; attack: 0; decay: 35ms; gain: 0.4; }
}
/* Or overlay: */
.actions { sound-mood: punchy; }
```

---

### `mood-warm` _(HIGH)_

> Most-requested adjective. Adds lowpass, removes brittleness.


_tags_: `mood, warmth, lowpass`
Two paths:

1. **Bake into the @sound** — add `filter: lowpass; cutoff: 2200..2800hz` to the
   body layer. Use this when the prompt says "make me a warm X".
2. **Cascade overlay** — `.scope { sound-mood: warm; }` applies the runtime warm
   filter to all sounds triggered inside that scope. Use this when the prompt
   describes a global UI vibe ("warm app").

Cutoff frequency: 2500 Hz is the sweet spot. Below 1.5 kHz → muffled. Above 4 kHz → no audible change.

Reference: `poc/runtime/mood.js` → `MOODS.warm`.

**Example:**

```css
/* Bake into @sound: */
@sound my-warm-bell {
  body { tones: 660hz, 990hz; decays: 0.6s, 0.4s;
         filter: lowpass; cutoff: 2500hz; gain: 0.4; }
}
/* OR apply at element: */
.warm-app { sound-mood: warm; }
```

---

### `mood-glassy` _(MEDIUM-HIGH)_

> A resonant peak around 4–6 kHz gives sounds a "glass-tap" character.


_tags_: `mood, glassy, resonance`
Two ingredients: high fundamentals (2–3 kHz minimum), and a resonant peak around 4.5 kHz.
The runtime `sound-mood: glassy` adds the peak via a peaking filter; baked into the `@sound`,
you achieve the same with a second tone an octave above the fundamental.

**Use sound-mood-mix** to dial it in: 1.0 = full glassy, 0.4 = subtle hint.
For UI ticks/clicks, 0.3–0.5 mix is plenty.

Reference: `poc/runtime/mood.js` → `MOODS.glassy`.

**Example:**

```css
@sound my-glass-tap {
  body { tones: 2400hz, 4800hz; decays: 0.3s, 0.18s; gain: 0.3; }
}
/* Or runtime overlay: */
.lab-tools { sound-mood: glassy; sound-mood-mix: 0.5; }
```

---

### `mood-airy` _(MEDIUM)_

> Subtle high-shelf + reverb send. Adds space.


_tags_: `mood, airy, reverb, space`
Two ingredients:
- High-shelf boost (subtle — 1–2 dB at 6 kHz).
- A small reverb send blended with the dry signal.

Best used in combination with a `room` setting at the element level — the mood
adds the high-shelf shimmer; the room adds the spatial reflections.

Often paired with `sound-mood-mix: 0.3..0.5` so the airiness is a hint, not a wash.

Reference: `poc/runtime/mood.js` → `MOODS.airy`.

**Example:**

```css
.calm-app { sound-mood: airy; sound-mood-mix: 0.4; }
/* Or pair with a room: */
dialog[open] { sound-mood: airy; room: medium-room; }
```

---

### `mood-metallic` _(MEDIUM)_

> Comb filtering at audible delays produces "robot/pipe" character.


_tags_: `mood, metallic, comb`
The signature is comb filtering at audible delays (~3–8 ms), which creates a series of
notches/peaks in the spectrum that the ear reads as "metallic". This is hard to express
purely in DSL — prefer the runtime overlay (`sound-mood: metallic`).

If you must bake it: layer two copies of the body with a 5 ms `start` offset and slight
detune (5–10 cents) — the constructive/destructive interference approximates a comb.

**Don't** use metallic on bright bell sounds — they already have inharmonic energy
and stacking metallic on top yields harsh.

Reference: `poc/runtime/mood.js` → `MOODS.metallic`.

**Example:**

```css
/* Best as runtime overlay — the comb filter is hard to bake into @sound: */
.industrial { sound-mood: metallic; }
@sound my-base { body { osc: triangle; freq: 880hz; decay: 0.4s; gain: 0.3; } }
```

---

### `mood-organic` _(MEDIUM)_

> Slow LFO on cutoff + mild detune. Adds breath and life.


_tags_: `mood, organic, lfo`
The runtime overlay applies a 1–3 Hz LFO on the filter cutoff plus mild detune.
Result: sounds drift slightly in tone over their decay, reading as "alive".

Useful for:
- Ambient apps where steady UI sounds feel sterile.
- Wellness / meditation interfaces.
- Long-form events (modal-open, page-enter) where stillness feels artificial.

**Don't** apply to short ticks/clicks (< 50 ms decay) — the LFO doesn't have time to
move noticeably.

Reference: `poc/runtime/mood.js` → `MOODS.organic`.

**Example:**

```css
.nature-app { sound-mood: organic; }
@sound my-tone { body { tones: 440hz, 660hz; decays: 0.5s, 0.35s; gain: 0.3; } }
```

---

### `mood-retro` _(MEDIUM)_

> Bandpass + bitcrush. 8-bit / arcade aesthetic.


_tags_: `mood, retro, bitcrush, arcade`
The runtime overlay does:
- Bandpass filter at 800–2000 Hz (cuts the deep bass and crystal highs).
- Bitcrush (sample rate reduction to ~8 kHz, 8-bit quantization).

To bake it into the `@sound` itself, use `osc: square` with no filter and let the
runtime's natural quantization do most of the work.

**Pair with** `poc/themes/retro.acs` for a full retro UI aesthetic.

**Don't** apply retro to a `success`/`complete` chord — the bitcrush makes the
chord sound dissonant rather than triumphant.

Reference: `poc/runtime/mood.js` → `MOODS.retro`.

**Example:**

```css
.game { sound-mood: retro; }
@sound my-blip { body { osc: square; freq: 880hz; decay: 80ms; gain: 0.3; } }
```

---


## 6. Layer shapes

_Decide single vs multi-layer in `pipeline-decide-layering`, then look up the shape._

### `layer-click-plus-body` _(HIGH)_

> The "satisfying button" archetype. Body gives identity; click gives the snap.


_tags_: `layer, click+body, transient`
The most-used multi-layer shape in ACS. Two layers fire simultaneously:

- **`body`** carries the *pitched* identity — what makes the sound recognizable
  as belonging to your UI vocabulary.
- **`click`** is a high-frequency noise burst with very short decay (5–15 ms) —
  it gives the sound the high-frequency "edge" that the ear reads as
  "I touched something solid".

#### Tuning the click layer

```
noise: white                /* white = bright "thwack"; pink = softer "thunk" */
filter: highpass             /* Always highpass — keeps it from muddying the body */
cutoff: 3000..6000hz         /* Higher = more "snap"; lower = more "thump"      */
decay: 5..15ms               /* Past 20 ms it stops feeling like a click        */
gain: 0.2..0.35              /* Generally lower than body's gain                */
```

#### Anti-patterns

- **Click layer with `osc` source**: technically works but defeats the purpose;
  noise layers couple better with the body's tonal core.
- **Same decay on both layers**: when both layers decay over the same window,
  the click loses its punch. Click should always decay much faster.
- **Click layer dominates body**: if `click.gain > body.gain`, the sound feels
  hollow. Body should always carry more energy than click.

#### When to use

Almost always — except for `event-tick` (single layer is enough) and
`event-error` (replace `click` with a noise rasp at lower frequencies).

Reference: `poc/defaults.acs` → `@sound tap`, `@sound tap-tactile`, `@sound thunk`,
`@sound woodblock`.

**Example:**

```css
@sound my-tap {
  body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
  click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
}
```

---

### `layer-single` _(HIGH)_

> The default. Most UI sounds are one layer. Don't over-stack.


_tags_: `layer, single`
A single-layer `@sound` has one block called `body`. This is the default for:

- Clicks, taps, ticks, hovers, focus events
- Any short transient (< 100 ms decay)
- Any sound where layering would muddy the identity

The convention is to name the layer `body` even when there's only one — this leaves
room to add a `click` layer later (see `layer-click-plus-body`) without renaming.

#### What goes inside `body`?

Pick exactly **one** source key (`tones` / `modal` / `osc` / `pluck` / `noise`),
optionally add modulation (`fm`, `pitch-from`, `detune`), envelope (`attack`,
`decay`), and output (`gain`, `pan`, `drive`). The runtime applies them in this order:

```
source → fm → detune → filter → envelope → drive → pan → output
```

#### Anti-patterns

- **Empty layer**: `body { gain: 0.3; }` — no source key. Runtime fails silently.
- **Two source keys in one layer**: `body { tones: 880hz; modal: 660hz; }` — the
  parser keeps the last one. Use two layers instead.
- **`gain: 1.0`**: hot-clipping. Calibrator scales down but you waste headroom.

Reference: `poc/runtime/dsp.js` → `playLayer()`.

**Example:**

```css
@sound my-single {
  body { osc: sine; freq: 1300hz; decay: 12ms; gain: 0.22; }
}
```

---

### `layer-ascending-chord` _(MEDIUM-HIGH)_

> Three or more notes spelling out a chord with cascading start times.


_tags_: `layer, chord, ascending, success`
Three (or four) layers, each a tone in a major chord, with `start` offsets that
cascade by 60–120 ms. Used for `success`, `complete`, achievement / level-up /
confetti events.

#### Why three notes?

Three notes is the inflection point: two notes feel like a paired-state cue
(see `layer-octave-pair`); four+ notes feel like a melody rather than a UI
beat. Three is "chord" without being "tune".

#### Picking the chord

The default is a **major triad** (root + major third + perfect fifth):

| Chord type | Frequencies (root = 660 Hz) | Vibe                     |
| ---------- | ---------------------------- | ------------------------ |
| Major      | 660, 825, 990                | Bright, classic positive |
| Sus4       | 660, 880, 990                | Open, pending resolution |
| Octaves    | 660, 1320, 1980              | Pure, less melodic       |
| Minor      | 660, 792, 990                | Don't — minor + UI = bad |

The example above uses simple integer ratios (1, 1.33, 2) which approximate a
"power chord" voicing — more direct than a true major triad, easier on the ear
in repeated UI contexts.

#### Cascading `start`

`start` offsets should *increase* with frequency for ascending success vibe.
Reverse for descending events (rare in UI, but possible for "level lost" /
"countdown ended").

A typical pattern:

```
n1: start: 0ms      lowest pitch
n2: start: 80ms     middle
n3: start: 160ms    highest
```

Total duration = `last start + last decay` ≈ 500 ms. Past 700 ms, the sound
starts feeling like a notification ringtone — too prescriptive.

#### Per-layer gain

Keep all layers at the *same* gain (0.18–0.25). If the third layer is louder
than the first, the chord feels lopsided.

Reference: `poc/defaults.acs` → `@sound success`, `@sound complete`.

**Example:**

```css
@sound my-success {
  n1 { tones: 660hz;  decay: 250ms; gain: 0.22; }
  n2 { tones: 880hz;  start: 80ms;  decay: 300ms; gain: 0.22; }
  n3 { tones: 1320hz; start: 160ms; decay: 350ms; gain: 0.22; }
}
```

---

### `layer-octave-pair` _(MEDIUM-HIGH)_

> Two layers spaced an octave apart. Used for paired-state events.


_tags_: `layer, octave, toggle`
Two body layers tuned an octave apart, the higher one delayed by a small `start`
offset (20–60 ms). The result is a brief two-note "rising tap" — very natural
for toggle-on, copy-confirm, send-success, and similar paired-state events.

#### Why two octaves apart?

An octave is the most consonant interval — the higher tone reinforces the
fundamental's perceived pitch rather than competing with it. Two notes separated
by anything other than an octave (perfect fifth, third, etc.) start to feel like
a chord, which carries more melodic intent than a UI sound usually wants.

#### Direction asymmetry

Use **higher delayed** (`start: 30ms` on the high layer) for "ON" / "confirm" /
"send" — the rising motion reads as positive activation.

Use **lower delayed** for "OFF" / "cancel" — descending feels deactivating.

#### Toggle-off variant

```css
@sound my-toggle-off {
  high { tones: 1320hz; decay: 60ms; gain: 0.22; }
  low  { tones: 660hz;  start: 30ms; decay: 80ms; gain: 0.25; }
}
```

Same notes, swapped order — descending instead of ascending.

#### Anti-patterns

- **Both layers starting at `start: 0`**: collapses to a fused chord, loses the
  paired-state perception.
- **Octave gap > 1 octave**: 2 octaves = bell-like ring (too long); 3 octaves =
  the high tone is barely audible. One octave is the sweet spot.

Reference: `poc/defaults.acs` → `@sound toggle-on`, `@sound toggle-off`.

**Example:**

```css
@sound my-toggle-on {
  low  { tones: 660hz;  decay: 80ms; gain: 0.25; }
  high { tones: 1320hz; start: 30ms; decay: 60ms; gain: 0.2; }
}
```

---


## 7. Effect recipes

_Add these to per-element rules (not to the @sound itself) — they live in the cascade._

### `effect-lowpass-warmth` _(HIGH)_

> The most-applied effect. Cuts brittleness; the agent's go-to for "warmer".


_tags_: `effect, lowpass, warmth, filter`
A lowpass filter on the body layer attenuates frequencies above the cutoff —
removing the high-frequency content that the ear reads as "brittle", "sharp",
or "digital". The result feels softer, more analog, more present without being
piercing.

#### Cutoff calibration table

| Cutoff       | Effect                                                          |
| ------------ | --------------------------------------------------------------- |
| 800 Hz       | Muffled / "telephone" quality. Use only for `lofi` aesthetic.    |
| 1500 Hz      | Strong warmth; loses some clarity.                               |
| **2200–2800 Hz** | **Sweet spot** — clearly warmer without losing intelligibility. |
| 3500 Hz      | Subtle hint of warmth.                                           |
| > 5000 Hz    | No audible change for most UI sounds.                            |

When the agent's brief says "warmer", the default cutoff is **2500 Hz**.
"Much warmer" → drop to 1800 Hz. "A touch warmer" → raise to 3200 Hz.

#### Q (resonance)

The runtime supports `q: <n>` on filters. For lowpass *warmth*, **don't set Q**
— a resonance peak at the cutoff produces a whistle that defeats the warming
effect. Default Q = 0.7 (Butterworth) is correct.

#### When to apply

- Prompt qualifier "warmer" / "softer" / "mellower".
- High-frequency presets (any preset whose body fundamental ≥ 1.5 kHz) that
  the user finds too sharp.
- Any preset paired with `mood: warm` if the runtime overlay alone isn't enough.

#### When NOT to apply

- Already-warm sounds (sub-1 kHz fundamentals) — they're not the problem.
- Click layers in `layer-click-plus-body` — those are *supposed* to be sharp.
- Error events — the warmth softens the dissonance.

Reference: `poc/runtime/dsp.js` → `playLayer()` filter branch.

**Example:**

```css
@sound my-warm {
  body {
    tones: 660hz, 990hz;
    decays: 0.5s, 0.35s;
    filter: lowpass; cutoff: 2500hz;     /* warmth */
    gain: 0.32;
  }
}
```

---

### `effect-reverb-tail` _(HIGH)_

> ACS reverb is per-element, not per-@sound. This rule covers when and how.


_tags_: `effect, reverb, room`
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

**Example:**

```css
/* Reverb is applied via the cascade, not inside the @sound: */
@sound my-bell { body { tones: 880hz, 1320hz; decays: 0.6s, 0.4s; gain: 0.32; } }

dialog[open]               { sound-on-appear: my-bell; room: small-room; }
.ambient-section button    { sound-on-click: my-bell; room: medium-room; }
```

---

### `effect-fm-bell` _(MEDIUM-HIGH)_

> A small amount of FM on a sine produces tasteful inharmonic body.


_tags_: `effect, fm, bell, modulation`
A small amount of frequency modulation on a sine carrier produces inharmonic
sidebands — the spectral signature of a bell. Without FM, a sine sounds pure
but lifeless. With too much FM, it sounds metallic or pinched.

#### Two parameters

```
fm: { ratio: <r>, depth: <d> }
```

- **ratio** — modulator frequency divided by carrier frequency.
  - `0.5` = sub-octave modulator, adds dark body.
  - `1` = unison, slight phase distortion.
  - `1.5` = perfect fifth above, classic bell.
  - `2` = octave above, brighter bell.
  - `2.76` = inharmonic ratio (Chowning's classic), most bell-like.
- **depth** — modulation index (Hz). Roughly 30–150 for tasteful FM.
  - `< 30` = barely audible inharmonicity.
  - `60–100` = clear bell character.
  - `> 200` = metallic/digital, often unwanted.

#### Sine vs other waveforms

FM is most predictable on **sine carriers** because there are no existing
harmonics to interfere with the sidebands. Triangle, square, and sawtooth
respond to FM but the result is harder to predict.

#### When to use FM

- The agent is trying to make a bell or chime and wants more character than
  pure tones provide.
- A click is too pure-sine for the desired vibe — adding light FM
  (`{ ratio: 0.5, depth: 60 }`) gives it perceived "weight" without changing
  the perceived pitch.
- The user explicitly asks for "inharmonic", "bell-like", "metallic".

#### When NOT to use FM

- High-velocity events (success chord, complete) — FM sidebands accumulate
  across multiple layers and turn into mud.
- Noise sources — FM has no defined behavior on noise (the runtime ignores it).

Reference: `poc/runtime/dsp.js` → `playOscLayer()` FM branch.

**Example:**

```css
@sound my-fm-bell {
  body {
    osc: sine;
    freq: 880hz;
    fm: { ratio: 1.5, depth: 80 };    /* subtle inharmonic shimmer */
    decay: 0.5s;
    gain: 0.32;
  }
}
```

---

### `effect-bandpass-noise-swoosh` _(MEDIUM)_

> Texture, not pitch. Bandpass center-frequency sweep produces "whoosh".


_tags_: `effect, bandpass, noise, swoosh`
A bandpass filter applied to a noise source produces a band-limited "shhh"
texture. Sweeping the center frequency over time (via `pitch-from`) moves
the perceived band, creating the universal "whoosh" effect.

#### Sweep direction

- **Low → High**: ascending whoosh — feels like something rising or sliding in.
- **High → Low**: descending — feels like something falling away or transitioning out.

#### Q controls "tightness"

| Q value | Character                                       |
| ------- | ----------------------------------------------- |
| 0.7     | Wide, breath-like — more "wind", less direction |
| **1.5** | **Default** — clear directional swoosh          |
| 3.0     | Tight, nearly tonal — laser-zip vibe             |
| 6.0+    | Self-oscillating ring — too narrow for noise    |

#### Sweep range

| Range (Hz)        | Vibe                                  |
| ----------------- | ------------------------------------- |
| 200 → 800         | Low whoosh, bass-heavy                |
| **800 → 3000**    | **Mid sweep — UI page transition**    |
| 1500 → 5000       | High whoosh, more "swish"             |
| 200 → 5000        | Wide cinematic sweep                  |

#### Noise color

- `noise: white` — bright, modern (default for UI).
- `noise: pink` — softer, more analog feel.
- `noise: brown` — bass-heavy, rumbly (rare for UI; use for cinematic).

Reference: `poc/defaults.acs` → `@sound swoosh`, `@sound whoosh`.

**Example:**

```css
@sound my-swoosh {
  body {
    noise: white;
    filter: bandpass; cutoff: 1500hz; q: 1.5;
    pitch-from: 800hz to 3000hz;
    decay: 250ms;
    gain: 0.35;
  }
}
```

---

### `effect-bitcrush-lofi` _(MEDIUM)_

> Sample-rate reduction approximation. Bake lightly via detune+distortion.


_tags_: `effect, bitcrush, lofi, retro`
True bitcrushing — sample-rate and bit-depth reduction — isn't expressible as a
per-layer DSL key in current ACS. The runtime applies it as part of the `lofi`
mood overlay (see `mood-lofi`). For one-off baking, approximate it with
**`drive` + `osc: square`**, which reproduces the harmonic intermodulation
characteristic of low-bit-depth audio.

#### Recipe (baked approximation)

| Ingredient            | Why                                           |
| --------------------- | --------------------------------------------- |
| `osc: square`         | Square's odd harmonics survive crushing well  |
| `drive: 0.3..0.6`     | Saturation mimics quantization distortion     |
| `detune: 3..10`       | Pitch instability ≈ low-rate clock jitter     |
| `filter: lowpass`     | Cutoff at ~3–4 kHz mimics anti-alias filter   |

The runtime overlay (`sound-mood: lofi`) does this properly with sample-rate
reduction; prefer it when the user wants a global vibe.

#### When to use the baked recipe

- A *single* preset needs the lofi vibe but the rest of the UI shouldn't.
- You're authoring a one-off `@sound` for a retro-themed component.
- The user explicitly requested "make THIS sound lofi" (not "make the app lofi").

#### Anti-patterns

- Stacking baked bitcrush on top of `sound-mood: lofi` — double application
  produces unintelligible mush.
- Using bitcrush with delicate `tones:` chords — chord clarity dies under heavy crush.

Reference: `poc/runtime/mood.js` → `MOODS.lofi`.

**Example:**

```css
/* Best as runtime overlay — true bitcrush isn't a per-layer DSL key: */
.game-ui { sound-mood: lofi; sound-mood-mix: 0.6; }

/* Manual approximation if you need it baked into one preset: */
@sound my-crushed {
  body {
    osc: square;            /* square inherently has more aliasing-friendly harmonics */
    freq: 880hz;
    detune: 5;              /* slight pitch instability */
    drive: 0.4;             /* harmonic distortion approximates quantization */
    filter: lowpass; cutoff: 4000hz;
    decay: 100ms;
    gain: 0.3;
  }
}
```

---


## 8. Audio interpretation

_Sub-steps for the audio-input path. Each emits a fragment; `pipeline-emit-and-render` merges them._

### `interpret-classify-waveform` _(HIGH)_

> When source = osc, this rule decides which waveform.


_tags_: `interpret, waveform, classification, osc`
Compare the amplitudes of the first 8 harmonics against the fundamental.
Each canonical waveform has a known signature.

#### Algorithm

```python
import numpy as np
from scipy.fft import rfft, rfftfreq
from analyze import classify_waveform

# Use a stable window after the attack transient
segment = data[int(sr * 0.005) : int(sr * 0.025)]   # 5–25 ms
segment = segment * np.hanning(len(segment))
spectrum = np.abs(rfft(segment))
freqs = rfftfreq(len(segment), 1 / sr)

waveform = classify_waveform(spectrum, freqs, fundamental_freq)
# -> "sine" | "triangle" | "square" | "sawtooth" | "wavetable"
```

#### Signature mapping

| Pattern                                         | Waveform     |
| ----------------------------------------------- | ------------ |
| Fundamental only, harmonics < -40 dB            | `sine`       |
| Odd harmonics rolling off as 1/n²               | `triangle`   |
| Odd harmonics at roughly 1/n amplitude          | `square`     |
| All harmonics rolling off as 1/n                | `sawtooth`   |
| Custom harmonic profile (none of the above)     | (no match — wavetable not yet supported in ACS DSL; fall back to closest match) |

#### Decision details

- **Sine vs triangle**: sine has the second harmonic at silence; triangle has
  the third at -19 dB. If H3 > -30 dB → triangle.
- **Square vs sawtooth**: square has only odd harmonics; sawtooth has all.
  Check H2: if H2 < -25 dB → square; else sawtooth.
- **Confidence threshold**: if no clean match (max correlation < 0.8 with any
  template), this isn't a clean osc — re-check `interpret-extract-source`,
  the source is probably `tones` or `modal`.

#### When this rule fires

Only when `interpret-extract-source` chose `osc`. For `tones`/`modal`/`pluck`/`noise`,
waveform classification is meaningless.

Reference: `analyzer/render.mjs` osc branch.

**Example:**

```css
/* Classification output:
 *   "sine"     → osc: sine
 *   "triangle" → osc: triangle
 *   "square"   → osc: square
 *   "sawtooth" → osc: sawtooth
 */
```

---

### `interpret-extract-envelope` _(HIGH)_

> Smooth amplitude, find onset/peak/sustain/end, derive ADSR stages.


_tags_: `interpret, envelope, adsr`
Smooth the time-domain amplitude into a low-rate envelope curve, then find the
four ADSR stage boundaries.

#### Algorithm

```python
from analyze import load_mono, extract_envelope

sr, data = load_mono("out/click.wav")
env = extract_envelope(data, sr)
# -> { "attack": 0.0008, "decay": 0.012, "sustain": 0.0, "release": 0.005 }
```

Internally `extract_envelope` does:

1. Take absolute value of waveform.
2. Apply a one-pole lowpass smoother (~100 Hz cutoff) to remove waveform-rate detail.
3. Find onset (first sample where envelope > 0.05 × peak).
4. Find peak (max of smoothed envelope).
5. Define `attack = peak_time - onset_time`.
6. Find sustain start: first sample after peak where envelope plateaus
   (slope < 1% of attack slope) for at least 30 ms; else sustain = 0.
7. Define `decay = sustain_start - peak_time` if sustain detected, else
   `decay = end_time - peak_time` (whole tail is decay).
8. If sustain detected, define `release = end_time - sustain_end`; else
   release = small constant (5 ms) to prevent click on emit.

#### Heuristics for ACS emit

- **`sustain < 0.01`** → drop the field entirely; the sound is percussive and
  ACS's envelope DSL doesn't require explicit sustain=0.
- **`attack < 0.001`** → set `attack: 0` (the runtime treats <1 ms attack as
  instant).
- **`release < 0.003`** → clamp to `0.005` to avoid clicks at sample end.
- **`decay > 2 s`** → almost certainly room reverb tail bleeding into the
  measurement; cap at the room's known tail length and emit `room: <name>`
  separately. See `interpret-detect-effects`.

#### When the source is `noise`

For broadband noise sources, replace `extract_envelope` with the same algorithm
applied to the broadband energy curve (RMS-windowed, not waveform). The result
maps to the same ACS keys.

Reference: `analyzer/render.mjs` envelope branch (inverse — synthesizes from ADSR).

**Example:**

```css
/* Output for a click WAV:
 *   { attack: 0, decay: 12ms, release: 5ms }
 *
 * Output for a sustained tone:
 *   { attack: 4ms, decay: 50ms, sustain: 0.6, release: 80ms }
 */
```

---

### `interpret-extract-fundamental` _(HIGH)_

> The pitched core of the sound. Static or sweeping — this rule decides.


_tags_: `interpret, fundamental, pitch, sweep`
Sample the spectrum at multiple time slices to detect both the static pitch and
any sweep over the duration of the sound.

#### Slice-and-FFT approach

```python
from analyze import load_mono, analyze_slice

sr, data = load_mono("out/click.wav")

# Take FFT slices at 0%, 10%, 25%, 50%, 75% of duration
duration = len(data) / sr
slices = [0, duration * 0.1, duration * 0.25, duration * 0.5, duration * 0.75]
freqs_over_time = [analyze_slice(data, sr, t) for t in slices]
```

#### Mapping

| Observation                         | Output                                           |
| ----------------------------------- | ------------------------------------------------ |
| All slices within ±5%               | `freq: <Hz>` (static)                             |
| Decreasing across slices            | `pitch-from: <high>hz to <low>hz`                 |
| Increasing across slices            | `pitch-from: <low>hz to <high>hz`                 |
| Non-monotonic (zigzag)              | Pick start and end as `pitch-from`; the runtime interpolates linearly. |
| No clear peak (broadband)           | This isn't a tonal sound — see `interpret-extract-source`. |

#### Tips

- Skip the first 1–2 ms if the onset is a click transient — the click pollutes
  the FFT with broadband energy.
- For very short sounds (< 20 ms), reduce to 2–3 slices and use a smaller FFT
  window (e.g., 256 samples).
- Use a Hanning window before FFT (already applied in `analyze_slice`) to
  reduce spectral leakage at slice boundaries.

#### When the source is `noise`

`noise` has no fundamental — but if a bandpass filter is detected (see
`interpret-detect-filter`) the bandpass center can sweep, which produces the
same audible effect. Emit `pitch-from` on the bandpass `cutoff` rather than
on a non-existent fundamental.

Reference: see `interpret-detect-filter` for filter-sweep extraction.

**Example:**

```css
/* For audio with static pitch:           freq: 880hz                  */
/* For audio with descending pitch sweep: pitch-from: 880hz to 440hz   */
```

---

### `interpret-extract-source` _(HIGH)_

> First and most important interpret step. Wrong source type makes every later step wrong.


_tags_: `interpret, source, audio`
Given a mono WAV file, decide which ACS source primitive best models it.
Decision is based on three measurements: **harmonic structure**, **decay shape**,
and **broadband energy**.

#### Decision tree

```
Spectral structure?
├─ Strong tonal peaks at integer multiples (1, 2, 3, …)
│  └─ Decay shape?
│     ├─ Smooth exponential, all partials decay together
│     │  └─ source: tones (additive sine bank)
│     ├─ Each partial has independent decay rate (high partials die first)
│     │  └─ source: modal (modal IIR resonator)
│     └─ Single partial, slowly damped
│        └─ source: pluck (Karplus-Strong)
├─ Strong tonal peaks at NON-integer multiples (inharmonic)
│  └─ source: modal (with custom ratios)
├─ Continuous spectrum (no isolated peaks)
│  └─ source: noise
│     ├─ Roughly flat spectrum   → noise: white
│     ├─ -3 dB/octave roll-off    → noise: pink
│     └─ -6 dB/octave roll-off    → noise: brown
└─ Single dominant peak with no harmonics, fixed waveform shape
   └─ source: osc (with classify-waveform downstream)
```

#### Measurement script

```python
from analyze import load_mono, harmonic_strength, decay_independence, spectral_flatness

sr, data = load_mono("out/click.wav")

harmonic   = harmonic_strength(data, sr)        # 0..1
indep      = decay_independence(data, sr)       # 0..1 (1 = each partial decays at own rate)
flatness   = spectral_flatness(data, sr)        # 0..1 (1 = perfectly flat = noise)

if flatness > 0.7:
    return "noise"
if harmonic > 0.5:
    return "modal" if indep > 0.5 else "tones"
return "osc"   # fallback — single peak, likely a basic waveform
```

#### Heuristic shortcuts

- **Decay < 50 ms + broadband**: almost always `noise` (e.g., a click or snare).
- **Sustained tone > 200 ms**: almost always `tones` or `modal`.
- **Pitch sweep audible**: tag with `pitch-from` regardless of source type.
- **Inharmonic ratio (e.g., 2.76) detected**: definitely `modal`, not `tones`.

Reference: `analyzer/render.mjs` (the inverse — synthesizes from source) gives
the canonical mapping you should match.

**Example:**

```css
/* No example — this rule fires on audio input only.
 * Output is one of: tones, modal, osc, pluck, noise. */
```

---

### `interpret-detect-filter` _(MEDIUM-HIGH)_

> A spectral roll-off or band-limit usually means a filter is in play.


_tags_: `interpret, filter, lowpass, highpass, bandpass`
Compare the source's expected spectrum (based on `interpret-classify-waveform`
or the noise color from `interpret-extract-source`) against the measured
spectrum. A consistent roll-off, lift, or band-limit indicates a filter.

#### Decision tree

```
Measured spectrum matches the source's natural spectrum?
├─ Yes → no filter
└─ No  → which deviation?
   ├─ Energy drops sharply above some frequency → lowpass
   ├─ Energy drops sharply below some frequency → highpass
   ├─ Energy concentrates around some frequency → bandpass
   ├─ Energy notched at one frequency           → notch (rare in ACS UI)
```

#### Cutoff extraction

For lowpass/highpass: find the -3 dB point (frequency where the log-magnitude
spectrum is 3 dB below the in-band plateau). That's `cutoff`.

For bandpass: find the spectral peak — that's `cutoff`. Width at -3 dB gives Q:
`Q ≈ cutoff / bandwidth`.

#### Heuristics

- **Sharp roll-off (12 dB/octave or steeper)** → use `tpt-lowpass` /
  `tpt-highpass` / `tpt-bandpass` — the runtime's TPT-SVF filters.
- **Gentle roll-off (6 dB/octave)** → use the regular `lowpass` / `highpass`.
- **Visible resonance peak at cutoff** → emit `q` ≥ 2; otherwise omit `q`
  (default 0.7 Butterworth).

#### When filter is "free" (no detection needed)

If `interpret-extract-source` chose `noise` and the spectrum has any
frequency dependence, you must emit a filter — the runtime's noise sources are
flat (white) / -3 dB/oct (pink) / -6 dB/oct (brown). Anything else is a filter.

Reference: `poc/runtime/dsp.js` filter branch.

**Example:**

```css
/* Output:
 *   filter: lowpass; cutoff: 2500hz
 *   filter: bandpass; cutoff: 1500hz; q: 1.5
 */
```

---

### `interpret-multi-layer` _(MEDIUM-HIGH)_

> Many UI sounds are layered. Treating them as single-source produces lossy reconstruction.


_tags_: `interpret, multi-layer`
A single-source model often can't fit the whole audio file — there's residual
energy that doesn't belong to the modeled body. The skill's job is to recognize
when this residual is itself a *layer*, not just noise to be discarded.

#### Algorithm

1. After running `interpret-extract-source` + `interpret-extract-envelope`,
   synthesize the modeled body via `analyzer/render.mjs`.
2. Subtract the synthesized body from the original. Compute residual RMS.
3. If residual RMS > 10% of original RMS → a second layer exists.
4. Re-run `interpret-extract-source` etc. on the residual — that's the second layer.

#### Common multi-layer archetypes

| Pattern                                                   | Likely shape                              |
| --------------------------------------------------------- | ----------------------------------------- |
| Tonal body + brief broadband transient at onset           | `layer-click-plus-body` (body + click)    |
| Two tonal peaks with slightly offset onsets               | `layer-octave-pair` or chord              |
| Three or more tonal peaks with cascading onsets           | `layer-ascending-chord`                   |
| Tonal body + sustained noise (e.g., rain on a bell)       | body + noise pad — both stay full duration |

#### Layer naming

When emitting, name layers by role:

- **Tonal core, longest decay** → `body`
- **Sharp transient at onset** → `click`
- **Higher-pitched stinger** → `snap` or `ping`
- **Sustained background texture** → `pad` or `tail`

#### Stop condition

If residual RMS drops below 5% of original after subtracting the second layer,
stop. Most UI sounds are 1–2 layers; 3-layer reconstructions exist (success
chord) but past 3 the model is overfitting the audio rather than capturing
authorial intent.

Reference: `analyzer/render.mjs` for synthesis (the inverse step).

**Example:**

```css
/* Output: a multi-layer @sound with body + click layers */
@sound reconstructed {
  body  { tones: 1.4khz; decay: 50ms; gain: 0.4; }
  click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
}
```

---

### `interpret-detect-effects` _(MEDIUM)_

> Effects extend the sound's footprint. Misidentifying the source as part of the body wastes layers.


_tags_: `interpret, effects, reverb, delay, saturation`
After source + envelope are extracted, look at what's left in the audio after
the modeled body decays. Anything beyond is an effect.

#### Detect reverb

Subtract the modeled body (synthesize via the chosen source + envelope) from
the original. The residual:

| Residual character                                  | Verdict                                    |
| --------------------------------------------------- | ------------------------------------------ |
| Diffuse, broadband, slow decay (> 200 ms)           | Reverb. Match tail length to a `room`.     |
| Discrete repeats at ~50–500 ms intervals            | Delay. Not a primary ACS DSL key — emit a comment.       |
| Continues at low level after body's expected end    | Likely reverb tail; estimate room.         |
| Nothing (residual is silent within tolerance)       | No effects. Body fully explains the audio. |

Map the residual's tail length to a room:

| Tail length | Room               |
| ----------- | ------------------ |
| < 0.2 s     | dry (no emit)      |
| 0.2 – 0.6 s | `small-room`       |
| 0.6 – 1.2 s | `medium-room`      |
| 1.2 – 2.0 s | `large-room`       |
| 2.0 – 3.5 s | `hall`             |
| 0.8 – 1.5 s, dense bright | `plate` |

Note: ACS rooms are per-element, not per-`@sound`. Emit room as a recommendation
for the cascade rule that uses the new preset, not inside the `@sound` block:

```css
@sound my-bell { body { tones: 880hz, 1320hz; decays: 0.6s, 0.4s; gain: 0.32; } }

/* Skill output also includes: */
/* dialog[open] { sound-on-appear: my-bell; room: small-room; } */
```

#### Detect saturation

Compare the harmonic content of the body to its source-type's expected content.
Excess even harmonics (esp. H2 at -20 to -10 dB) indicates soft saturation.

Map saturation amount to `drive`:

| Excess H2 level | `drive` value |
| --------------- | ------------- |
| < -25 dB        | 0 (no emit)   |
| -25 to -15 dB   | 0.2           |
| -15 to -8 dB    | 0.4           |
| -8 to -3 dB     | 0.6           |
| > -3 dB         | 0.8 (strong distortion — verify intent) |

`drive` is a per-layer key, so it goes inside the layer block.

#### Detect chorus / detune

Multiple closely-spaced peaks around the fundamental (within ±20 cents)
indicates detune. Emit `detune: <cents>` on the layer.

Reference: `poc/runtime/audio.js` (rooms), `poc/runtime/dsp.js` (drive, detune).

**Example:**

```css
/* Output (these become per-element cascade rules, not @sound-internal):
 *   room: small-room       (when reverb tail detected)
 *   drive: 0.4              (when soft saturation detected)
 */
```

---

### `interpret-detect-lfo` _(MEDIUM)_

> Sidebands around the fundamental indicate modulation. FM is the most ACS-relevant case.


_tags_: `interpret, lfo, fm, modulation`
If the spectrum around the fundamental shows symmetric sideband peaks, FM is
in play. The sideband spacing reveals the modulator frequency; the sideband
strength reveals the depth.

#### FM detection

```python
peaks = find_spectral_peaks(spectrum, freqs)
fundamental = fundamental_freq

# Find peaks within an octave of the fundamental, sorted by strength.
# Symmetric pairs around the fundamental (f ± k·m) indicate FM with
# modulator frequency m and modulation index proportional to k.

sideband_pairs = find_symmetric_sidebands(peaks, fundamental)
if sideband_pairs:
    modulator_hz = sideband_pairs[0].spacing
    ratio = modulator_hz / fundamental
    depth = estimate_depth_from_sideband_amplitudes(sideband_pairs)
    return { "fm": { "ratio": round(ratio, 2), "depth": int(depth) } }

return None
```

#### Mapping to ACS

| Detection                                | Emit                                       |
| ---------------------------------------- | ------------------------------------------ |
| Symmetric sidebands at f ± k × m         | `fm: { ratio: m/f, depth: <Hz> }`           |
| Single peak near fundamental, no sidebands | nothing — pure carrier                    |
| Multiple closely-spaced peaks (< 20 cents) | `detune: <cents>` (not FM)                |
| Slow amplitude wobble (no spectral sidebands) | tremolo — not directly expressible in ACS DSL; comment in output |

#### FM ratio interpretation

| Ratio        | Character                                    |
| ------------ | -------------------------------------------- |
| 0.5          | Sub-octave modulator → adds dark body        |
| 1.0          | Carrier modulates itself → phase distortion  |
| 1.5          | Perfect fifth above → classic bell           |
| 2.0          | Octave above → brighter bell                 |
| 2.76         | Inharmonic Chowning ratio → most bell-like   |
| Non-integer  | Inharmonic; emit as-is                       |

Round to two decimal places when emitting.

#### Depth interpretation

Modulation index converts to ACS `depth` (Hz) directly. Typical UI range:
30–200. Above 300, the sound becomes unstable / metallic — the agent should
note this in the rationale even if measured.

Reference: `poc/runtime/dsp.js` → `playOscLayer()` FM branch.

**Example:**

```css
/* Output:
 *   fm: { ratio: 1.5, depth: 80 }       — FM detected
 *   detune: 10                          — detune detected (no LFO depth, just static cents)
 */
```

---


## 9. Validation

_Run after emit. Reject and refine if any tolerance fails._

### `validate-duration-cap` _(HIGH)_

> Long UI sounds block follow-on triggers, accumulate, and frustrate users.


_tags_: `validate, duration, decay`
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

**Example:**

```css
/* OK — short tap, well under cap */
@sound ok-tap { body { tones: 1.4khz; decay: 50ms; gain: 0.4; } }

/* FAIL — 2.5s decay on a tap is ridiculous */
@sound bad-tap { body { tones: 1.4khz; decay: 2500ms; gain: 0.4; } }
```

---

### `validate-frequency-bounds` _(HIGH)_

> Out-of-band fundamentals waste energy and can clip the limiter.


_tags_: `validate, frequency, bounds`
UI sounds need to live within a frequency band where:

1. Most consumer speakers can reproduce them.
2. The ear hears them as "tones", not "thumps" or "whistles".
3. Repeated triggers don't fatigue the listener.

#### Recommended bounds

| Band           | Range          | Use case                                  |
| -------------- | -------------- | ----------------------------------------- |
| Reject (low)   | < 80 Hz        | Sub-bass; not for UI sounds               |
| **Body band** | **80 – 4000 Hz** | **Fundamentals live here**                |
| Click band     | 4 – 8 kHz      | Click layers in `layer-click-plus-body`   |
| Reject (high)  | > 10 kHz       | Piercing; fatiguing on repeats            |

#### Per-source-type guidance

- **`tones`** / **`modal`** — fundamentals must be 80–4000 Hz. Higher partials
  (modal `ratios`) can extend to 10 kHz.
- **`pluck`** — 80–2000 Hz works; above 2 kHz sounds artificial.
- **`osc`** with `pitch-from` — both `start` and `end` should be in 80–4000 Hz.
- **`noise` + bandpass `cutoff`** — center 1–6 kHz; above 8 kHz the noise sounds
  like crystal hiss rather than a swoosh.

#### Validation step

When emitting an `@sound`, scan every frequency-typed value (`freq`, `cutoff`,
`tones`, `modal`, both ends of `pitch-from`) and assert it's in the recommended
band for its source type. If out of bounds, reject and re-emit with a clamped
value:

```
freq = clamp(intended, 80, 4000)
cutoff = clamp(intended, 200, 8000)
```

Reference: `poc/runtime/parse.js` → `parseFreq()`.

**Example:**

```css
/* OK — fundamental at 880 Hz, well within UI band */
@sound ok { body { tones: 880hz; decay: 200ms; gain: 0.3; } }

/* FAIL — 30 Hz fundamental: wasted energy, sub-bass on most speakers */
@sound bad-low { body { tones: 30hz; decay: 200ms; gain: 0.3; } }

/* FAIL — 12 kHz fundamental: piercing, fatigues the ear */
@sound bad-high { body { tones: 12000hz; decay: 200ms; gain: 0.3; } }
```

---

### `validate-gain-budget` _(HIGH)_

> Sum-of-gains over budget produces clipping; a calibrated runtime can compensate but only so far.


_tags_: `validate, gain, budget`
After emit, sum every layer's `gain`. The total should be:

| Sum             | Verdict                                                 |
| --------------- | ------------------------------------------------------- |
| ≤ 0.6           | ✅ Comfortable. Plenty of calibration headroom.          |
| 0.6 – 0.9       | ⚠️ Acceptable but tight. Calibrator may scale aggressively. |
| 0.9 – 1.2       | ❌ Reject. Re-emit with proportionally lower gains.      |
| > 1.2           | ❌ Hard reject. This will clip.                          |

#### Why the budget exists

ACS's calibrator measures every preset offline and bakes a multiplier so
`volume: 0.5` sounds equally loud across the library. If the raw `gain`
values are too hot, the calibrator's headroom shrinks — bright sources end
up sounding compressed, dull sources end up under-leveled.

The 0.6 budget gives the calibrator at least 4 dB to work with on the upper
end (loud presets) and 2 dB on the lower end (quiet presets), maintaining
the 4.8 dB target spread.

#### How to fix overruns

1. **Halve every gain proportionally** — if budget = 1.2, multiply each layer's
   gain by 0.5. The relative balance is preserved; total drops to 0.6.
2. **Drop the least-essential layer** — for `success`-style chords, dropping
   the third tone is often inaudible.
3. **Move shaping into `drive`** — perceived loudness can come from saturation
   rather than gain. `drive: 0.3` adds harmonic content without consuming
   gain budget.

Reference: `poc/runtime/calibrate.js`.

**Example:**

```css
/* OK — budget = 0.4 + 0.3 = 0.7 (within 1.0 limit, headroom remains) */
@sound ok {
  body  { tones: 1khz; decay: 50ms; gain: 0.4; }
  click { noise: white; filter: highpass; cutoff: 4khz; decay: 8ms; gain: 0.3; }
}

/* FAIL — budget = 0.6 + 0.5 + 0.4 = 1.5; the calibrator scales, but tonally muddied */
@sound fail {
  body { ...; gain: 0.6; }
  midd { ...; gain: 0.5; }
  high { ...; gain: 0.4; }
}
```

---

### `validate-schema-conformance` _(HIGH)_

> A typo'd preset name silently fails. A typo'd property name silently fails. Catch them early.


_tags_: `validate, schema, parser`
Round-trip the emitted `@sound` through the ACS parser before declaring success.
Three checks:

### 1. Layer keys are recognized

Each key inside a layer block must be one of:

```
Source:    tones, modal, osc, pluck, noise
Modulation: fm, pitch-from, detune, filter, cutoff, q
Envelope:  attack, decay, decays, release
Output:    gain, drive, pan, start, realtime
Misc:      ratios, gains, brightness, freq, source-options
```

Anything else is silently dropped by the parser. The linter in
`tools/lint-acs.mjs` catches typos via fuzzy match against this list.

### 2. Source key conflicts

Each layer must have **exactly one** source key. Multiple sources in the same
layer keep the last one — usually a copy-paste artifact, almost always a bug.

```css
/* BAD — both tones and modal: parser keeps modal, the user probably wanted tones. */
body { tones: 880hz; modal: 660hz; ratios: 1 1.5; ... }
```

### 3. Cross-references resolve

Any `sound: <name>`, `sound-on-click: <name>`, etc. that references a preset
name must resolve to either:

- A built-in preset in `poc/defaults.acs`, or
- A `@sound` block defined earlier in the same stylesheet (or any linked one).

If neither, the trigger silently fails. Run the linter:

```bash
npx acs-audio/lint your-style.acs
# error: my-style.acs:14: unknown preset "tap-soft" — did you mean "click-soft"?
```

#### How to perform this validation in the skill pipeline

1. Parse the emitted `@sound` block via `import("acs-audio/parse")`.
2. Walk the AST; assert every layer-internal key is in the schema set.
3. Run the linter against a synthetic stylesheet containing the new preset
   plus its intended use (e.g., `button:on-click { sound: my-new; }`).
4. If any error/warning, refine and retry — never ship a preset with linter errors.

Reference: `poc/runtime/parse.js`, `poc/runtime/validate.js`, `tools/lint-acs.mjs`.

**Example:**

```css
/* OK — every key is in the schema */
@sound ok {
  body { osc: sine; freq: 880hz; decay: 200ms; gain: 0.3; }
}

/* FAIL — 'frequecny' is a typo; runtime ignores the key, layer plays at default 440hz */
@sound typo {
  body { osc: sine; frequecny: 880hz; decay: 200ms; gain: 0.3; }
}
```

---

### `validate-envelope-sanity` _(MEDIUM-HIGH)_

> Short envelopes with no release click. Long releases on percussive sounds tail forever.


_tags_: `validate, envelope, attack, decay, release`
Envelopes have three knobs: `attack`, `decay`, `release`. Most UI sounds skip
`release`, but very-short percussive sounds need at least 3–5 ms release to
prevent end-of-sample clicks.

#### Sanity rules

1. **`decay > 30 ms` and `release` not set** → add `release: 5ms` to prevent clicks.
2. **`attack > decay`** → unusual; reads as "rising tone". Double-check intent.
3. **`release > 0.5 × decay`** → release dominates; rare for percussive UI. Often a copy-paste error.
4. **`attack > 50 ms` on a click/tap event** → defeats the "instant" feel. Set to 0.
5. **`decay < 5 ms`** → audible only as a click, not a tone. Use `noise` source instead.

#### Why micro-release matters

When a layer's amplitude drops to 0 instantaneously (no release), the sample
can end on a non-zero value, producing a discontinuity that the speaker
reproduces as a click. A 3–5 ms linear ramp to zero eliminates the artifact
without making the sound feel "squishy".

The runtime applies a tiny default release of 1 ms internally, but explicit
`release` in the `@sound` overrides it — so authors should either omit the
key entirely (lets the runtime handle it) or set a value ≥ 3 ms.

#### Multi-layer envelope coordination

When a preset has multiple layers, their envelopes don't have to match — but
they should be consistent in *style*. A preset with one snappy layer and one
sustained layer feels confused. Either all layers are percussive (no release,
short decay), or all are sustained (longer decay, audible release).

Reference: `poc/runtime/dsp.js` → envelope branch.

**Example:**

```css
/* OK — instant attack, short decay, micro release prevents click */
@sound ok { body { tones: 1.4khz; attack: 0; decay: 50ms; release: 5ms; gain: 0.4; } }

/* FAIL — no release; the sample-end sample-and-hold can pop */
@sound poppy { body { tones: 1.4khz; attack: 0; decay: 50ms; gain: 0.4; } }
```

---


## Reference

- ACS runtime source: `poc/runtime/`
- Built-in 49 presets: `poc/defaults.acs` (use these names in `sound:` declarations)
- Linter (catches typo'd preset names): `tools/lint-acs.mjs`
- Audition any preset in VSCode: ▶ CodeLens above the `@sound` line
