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
