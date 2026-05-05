---
name: create-acs-sound
description: Generate an ACS @sound block from a natural-language prompt, an audio file, or both. Use when the user says "create a sound", "/create-acs-sound", "design a sound for X", shares a WAV/MP3, or asks to reverse-engineer a sample. Optionally renders a WAV preview and round-trip-validates the result.
---

# Create ACS Sound

Generate an ACS `@sound` block from a prompt, an audio file, or both.

## How to use this skill — progressive disclosure

This file is the INDEX, not the manual. Each rule lives in its own
file under `skills/create-acs-sound/rules/<slug>.md`.

**Open each rule with the `Read` tool the moment you start the step
that needs it.** Do not try to recall rule bodies from memory — every
rule has specific frequencies, decays, gain budgets, and "incorrect /
correct" examples that you will hallucinate if you try to summarize
without reading. The whole point of the index is so that the agent
loads only the few rules a single task actually needs.

A typical run loads 4–8 rule files: one pipeline step, one event,
one or two moods, one layer shape, one or two validators. Not 50.

## Pipeline (read each on demand)

Run these in order. Each step has its own rule file with the full
procedure, examples, and edge cases.

1. **Detect input mode** — `rules/pipeline-detect-input.md`
   Decide between prompt-only / audio-only / prompt+audio paths.
2. **Pick base layer** — `rules/pipeline-pick-base-layer.md`
   Tokenize the prompt; select one `event-*` rule. Read that rule.
3. **Decide layering** — `rules/pipeline-decide-layering.md`
   Single layer vs body+click vs ascending chord etc. Read the chosen `layer-*` rule.
4. **Apply mood** — `rules/pipeline-apply-mood.md`
   Map adjectives ("warm", "metallic", "lofi") to `mood-*` rules. Read each one applied.
5. **Emit and render** — `rules/pipeline-emit-and-render.md`
   Write the `@sound` block, then walk all `validate-*` rules. Read each before checking.

## Rules index

### Pipeline (orchestration)

_Read these in pipeline order; each is a procedural step._

- `pipeline-detect-input` _(CRITICAL)_ — First branch — wrong choice means running the wrong rules
- `pipeline-pick-base-layer` _(CRITICAL)_ — Sets the entire shape of the output; the wrong base layer means starting from scratch later
- `pipeline-apply-mood` _(HIGH)_ — Adjectives carry intent; ignoring them produces a generic-sounding preset
- `pipeline-emit-and-render` _(HIGH)_ — Final step. Output must be paste-ready ACS plus a short rationale
- `pipeline-decide-layering` _(MEDIUM-HIGH)_ — A satisfying click is body+click; a satisfying success is a chord. Picking the wrong layer count loses character

### Event base layers — pick one

_Match the prompt's strongest event signal against `Triggers`. Open exactly one file._

- `event-click` _(HIGH)_ — triggers: click button press
- `event-error` _(HIGH)_ — triggers: error fail wrong invalid denied delete destroy
- `event-modal-close` _(HIGH)_ — triggers: modal dialog close dismiss out hide collapse cancel
- `event-modal-open` _(HIGH)_ — triggers: modal dialog popup drawer sheet open appear show expand
- `event-notification` _(HIGH)_ — triggers: notification alert ding bell mention badge incoming
- `event-success` _(HIGH)_ — triggers: success complete confirm done win achievement
- `event-tap` _(HIGH)_ — triggers: tap touch press button
- `event-tick` _(HIGH)_ — triggers: tick scroll snap focus hover
- `event-complete` _(MEDIUM-HIGH)_ — triggers: complete unlock achievement level-up confetti finished
- `event-toggle` _(MEDIUM-HIGH)_ — triggers: toggle switch on off check uncheck
- `event-swoosh` _(MEDIUM)_ — triggers: swoosh slide transition page tab whoosh
- `event-whoosh` _(MEDIUM)_ — triggers: whoosh dramatic reveal hero animation

### Mood overlays — stack as needed

_Map prompt adjectives to mood files. Multiple may stack — open each you apply._

- `mood-bright` _(HIGH)_ — triggers: bright brighter crisp shiny sparkle
- `mood-lofi` _(HIGH)_ — triggers: lofi lo-fi cassette tape vintage muffled
- `mood-punchy` _(HIGH)_ — triggers: punchy tight snappy crisp punchier
- `mood-warm` _(HIGH)_ — triggers: warm warmer mellow soft cozy
- `mood-glassy` _(MEDIUM-HIGH)_ — triggers: glassy crystal glass icy
- `mood-airy` _(MEDIUM)_ — triggers: airy spacious open soft ethereal
- `mood-metallic` _(MEDIUM)_ — triggers: metallic robot pipe industrial
- `mood-organic` _(MEDIUM)_ — triggers: organic breath alive natural soft
- `mood-retro` _(MEDIUM)_ — triggers: retro 8-bit arcade chiptune vintage

### Layer shapes — single vs multi

_Pick a layer shape from `pipeline-decide-layering`, then open the corresponding file._

- `layer-click-plus-body` _(HIGH)_ — triggers: tap satisfying tactile button responsive press
- `layer-single` _(HIGH)_ — triggers: click tap tick hover focus single simple
- `layer-ascending-chord` _(MEDIUM-HIGH)_ — triggers: success complete achievement level-up chord triumph
- `layer-octave-pair` _(MEDIUM-HIGH)_ — triggers: toggle switch on off paired state

### Effect recipes — applied at element level, not in @sound

_These describe per-element decls (room, filter, mood-mix). Read when the user asks for room/space/character._

- `effect-lowpass-warmth` _(HIGH)_ — triggers: warm warmer mellow soft muffled
- `effect-reverb-tail` _(HIGH)_ — triggers: reverb echo tail room space
- `effect-fm-bell` _(MEDIUM-HIGH)_ — triggers: bell metallic chime fm modulation
- `effect-bandpass-noise-swoosh` _(MEDIUM)_ — triggers: swoosh whoosh slide transition
- `effect-bitcrush-lofi` _(MEDIUM)_ — triggers: bitcrush lofi crushed retro 8-bit

### Audio interpretation — for prompt+audio path

_Sub-steps of audio analysis. Open each in order when the input includes a sample._

- `interpret-classify-waveform` _(HIGH)_ — When source = osc, this rule decides which waveform
- `interpret-extract-envelope` _(HIGH)_ — Smooth amplitude, find onset/peak/sustain/end, derive ADSR stages
- `interpret-extract-fundamental` _(HIGH)_ — The pitched core of the sound. Static or sweeping — this rule decides
- `interpret-extract-source` _(HIGH)_ — First and most important interpret step. Wrong source type makes every later step wrong
- `interpret-detect-filter` _(MEDIUM-HIGH)_ — A spectral roll-off or band-limit usually means a filter is in play
- `interpret-multi-layer` _(MEDIUM-HIGH)_ — Many UI sounds are layered. Treating them as single-source produces lossy reconstruction
- `interpret-detect-effects` _(MEDIUM)_ — Effects extend the sound's footprint. Misidentifying the source as part of the body wastes layers
- `interpret-detect-lfo` _(MEDIUM)_ — Sidebands around the fundamental indicate modulation. FM is the most ACS-relevant case

### Validation — run after emit

_Open before each check; the thresholds are specific (decay caps, gain budgets, frequency bounds)._

- `validate-duration-cap` _(HIGH)_ — Long UI sounds block follow-on triggers, accumulate, and frustrate users
- `validate-frequency-bounds` _(HIGH)_ — Out-of-band fundamentals waste energy and can clip the limiter
- `validate-gain-budget` _(HIGH)_ — Sum-of-gains over budget produces clipping; a calibrated runtime can compensate but only so far
- `validate-schema-conformance` _(HIGH)_ — A typo'd preset name silently fails. A typo'd property name silently fails. Catch them early
- `validate-envelope-sanity` _(MEDIUM-HIGH)_ — Short envelopes with no release click. Long releases on percussive sounds tail forever

## Reference

- ACS runtime source: `poc/runtime/`
- Built-in 49 presets: `poc/defaults.acs` (preset names go in `sound:` declarations)
- Linter (catches typo'd preset names + unknown properties): `tools/lint-acs.mjs`
- Audition any preset in VSCode: ▶ CodeLens above the `@sound` line
