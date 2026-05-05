---
name: acs-soundscape
description: Design a project-specific sound layer for a website or app. Use when the user says "add ACS to my site", "wire up sounds for this page", "give this project a sound identity", or hands you a project directory and asks for an `.acs` file. NOT for designing a single sound — for that, use `create-acs-sound`. This skill produces a complete `.acs` stylesheet with custom `@sound` blocks tailored to the project's visual identity, copy, and product character.
---

# ACS Soundscape

Design a sound layer that belongs to **this** project. Not a generic
UI sound kit dropped into a foreign aesthetic.

## Why this skill exists — and what it forbids

Default presets (`tap-tactile`, `tick`, `pop`, `click`) are shipped
with the runtime as a baseline. They are **not** an answer for a
project that has any visual identity at all. Binding `sound-on-click:
tap-tactile` on a CRT-terminal site, on a brutalist editorial, or on
a luxury watchmaker's page produces the same boring SaaS-tap
everywhere — the opposite of what a sound layer should do.

**Hard rules this skill enforces:**

1. **Read the project first.** Open the README, the global CSS,
   the hero JSX/HTML, and the product copy with `Read` before
   touching `.acs`. Specific files to open are listed in
   `rules/pipeline-inventory.md`.
2. **Author custom `@sound` blocks.** Every soundscape ships at
   least 5 project-named presets (e.g. `caret-tap`, `caret-cursor`,
   `caret-modem`). The stylesheet starts with these `@sound` blocks,
   then binds them to selectors.
3. **Defaults are a last resort.** A binding to a default preset
   (`sound: tap`) requires a comment explaining why _this default
   fits this project's voice_ — and the file must still contain
   custom presets in the majority. Validators flag soundscapes that
   are >40% default-bound.
4. **No two projects sound the same.** The frequencies, decays,
   filters, and mood overlays come from the project's tokens, not
   from a memorized recipe. If a previous project shipped a 1200 Hz
   tap, this one's tap should not also be 1200 Hz unless the tokens
   independently demand it.

## How to use this skill — progressive disclosure

This file is the INDEX. Pipeline steps and reference tables live
under `skills/acs-soundscape/rules/<slug>.md`.

**Open each rule with `Read` the moment you start the step that
needs it.** The rule files contain specific token-to-parameter
mappings, archetype templates, and validators that you will
hallucinate if you summarize from memory. A typical run loads
8–14 rule files; you do not need all of them.

When this skill needs a single new preset crafted from scratch,
delegate to the `create-acs-sound` skill — that one is for
authoring one `@sound` block; this one is for designing a
whole stylesheet.

## Pipeline — read each on demand

Run in order. Do not skip pipeline-inventory; everything downstream
depends on what it surfaces.

1. **Inventory the project** — `rules/pipeline-inventory.md`
   Read README, package.json, globals.css, hero/footer markup, copy.
   Output: a paragraph naming the product, audience, dominant aesthetic.
2. **Extract design tokens** — `rules/pipeline-extract-tokens.md`
   Read each `token-*.md` rule that applies (color, type, radius,
   motion, shadow, copy). Each emits a small mapping into the
   sonic-parameter space.
3. **Pick or compose an archetype** — `rules/pipeline-archetype.md`
   Read `rules/archetype-list.md`. Choose the closest, then DEPART
   from it based on the token sheet. Never apply an archetype verbatim.
4. **Write the sonic identity statement** — `rules/pipeline-identity-statement.md`
   3–4 sentences in plain English describing what an interaction
   should _feel_ like. This is the brief for every `@sound` you author.
5. **Author custom `@sound` blocks** — `rules/pipeline-author-customs.md`
   For each interaction the page actually has (click, hover, page-enter,
   modal-open, copy-confirm…), design a project-named preset. When the
   acoustic decisions for one preset get specific, hand off to
   `create-acs-sound`.
6. **Bind selectors** — `rules/pipeline-bind.md`
   Write the `.acs` file: custom `@sound` blocks first, then selector
   bindings. Cascade by specificity. Use `room`, `volume`, `pitch`,
   and `sound-mood` overrides to give the same preset different
   personalities in different contexts.
7. **Validate** — `rules/validate-*.md`
   Read each validator before checking. Reject and rework if any fail.

## Rules index

### Pipeline (orchestration)

_Read in pipeline order. Each is a procedural step._

- `pipeline-author-customs` _(CRITICAL)_ — Custom presets are the difference between a soundscape and a default kit. A soundscape with zero customs is a failed soundscape
- `pipeline-extract-tokens` _(CRITICAL)_ — The token sheet is the bridge between visual identity and acoustic decisions. Without it you are guessing
- `pipeline-inventory` _(CRITICAL)_ — You cannot design a project-specific soundscape without first knowing what the project IS. Skipping this step is how generic SaaS-tap output happens
- `pipeline-archetype` _(HIGH)_ — Archetypes give the soundscape a starting genre. Without one, presets drift; with one used as a recipe, every project sounds the same
- `pipeline-bind` _(HIGH)_ — Even great presets are wasted if the bindings are sloppy. The cascade is part of the identity
- `pipeline-identity-statement` _(HIGH)_ — Every preset is a test against this statement. Without it the soundscape drifts into incoherence

### Token mappings — design system → sound parameters

_Open the rules that match the project's actual tokens. A site with no shadow scale doesn't need `token-shadow`._

- `token-color` _(HIGH)_ — Color is the loudest visual signal of mood; ignoring it produces a soundscape that fights the page
- `token-type` _(HIGH)_ — Type is the most-touched visual surface; matching its grain and weight in sound is half the identity work
- `token-copy` _(MEDIUM-HIGH)_ — The copy is the project speaking out loud. The soundscape's mood must match what the words sound like
- `token-motion` _(MEDIUM-HIGH)_ — Sound and motion are felt as one event. A 350 ms decay on a 100 ms transition feels laggy
- `token-radius` _(MEDIUM-HIGH)_ — A page with sharp corners and soft, bouncy clicks reads as off-brand
- `token-shadow` _(MEDIUM)_ — Shadow is the visual proxy for depth. Reverb is the auditory proxy. They must agree

### Archetypes — starting templates (depart from them, never copy)

_These are reference points, not recipes. Read at most one or two; then deviate based on tokens._

- `archetype-list` _(HIGH)_ — The starting points for soundscape design. Pick one or two, then DEPART

### Validation — run after the .acs file is written

_Open before each check; the thresholds are explicit._

- `validate-no-default-binding` _(CRITICAL)_ — This is the validator that catches generic-output failure mode. Without it the skill regresses to "drop tap-tactile on every button"
- `validate-coherence` _(HIGH)_ — A soundscape is a family of related sounds, not a sample pack. Drift between presets reads as confusion
- `validate-distinct-naming` _(HIGH)_ — Naming presets `tap` or `click` (no prefix) is one rename away from a default-binding regression. Prefixes prevent that
- `validate-token-fit` _(HIGH)_ — The token sheet is meaningless if the authored presets ignore it. This validator closes the loop

## Reference

- ACS runtime source: `poc/runtime/`
- Built-in 49 presets: `poc/defaults.acs` (use as inspiration, not as bindings)
- Linter: `tools/lint-acs.mjs`
- Sister skill (single-preset author): `skills/create-acs-sound/SKILL.md`
