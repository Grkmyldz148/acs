---
title: Author custom @sound blocks
impact: CRITICAL
impactDescription: Custom presets are the difference between a soundscape and a default kit. A soundscape with zero customs is a failed soundscape.
tags: pipeline, author, presets
---

## Author custom @sound blocks

For each interaction the page actually has, design a project-named
preset. The output is a list of `@sound <prefix>-<role> { ... }`
blocks that will go at the top of the `.acs` file.

### Step 1 — enumerate the actual interactions

Walk the page in your head (or with `Read` if needed). What does
the user do? Typical items, in priority order:

- Click a button or CTA (often two flavors: primary, secondary)
- Hover a nav link or footer link
- Open / close a modal, drawer, or dropdown
- Copy a code block or command
- Scroll into a new section (one-shot per heading, not continuous)
- Page enter (mounts once)
- Toggle a theme / setting

Don't author presets for interactions the page doesn't have. A
landing page with no modals does not get a `modal-open` preset.

### Step 2 — pick a project prefix

Three letters minimum, taken from the product name. Examples:
- Caret → `caret-` or `crt-`
- Notion-like → `notn-`
- a brand named "Forge" → `frg-` or `forge-`

The prefix forces every binding to read as project-specific:
`sound: caret-tap` is unambiguously "this project's tap", not the
runtime default.

### Step 3 — design each preset

For each interaction, decide acoustic parameters from your token
sheet + identity statement. When the parameters get specific,
hand off to `create-acs-sound`:

> "Design a preset for the page-enter event of a CRT-terminal
> CLI tool. Identity statement says: phosphor warm-up fading in
> 600 ms. Tokens: phosphor-green palette, mono type, 0px radius,
> dry rooms. Output as `@sound caret-power-on`."

`create-acs-sound` will return a layered `@sound` block. Iterate
on it (request "warmer", "shorter", "less metallic") until it
matches the brief.

### Step 4 — keep the family coherent

All custom presets in one file should share at least one of:
- A fundamental-frequency band (e.g. all bodies between 800–1500 Hz)
- An attack character (e.g. all attacks 1–3 ms — sharp family)
- A decay character (e.g. all decays 30–80 ms — short family)
- A signature filter or saturation (e.g. all noise layers
  bandpass at 2 kHz Q=0.8)

Pick at least one cohering trait and apply it across the family.
Without this, the soundscape sounds like a random sample pack.

### What you produce

Between 5 and 10 `@sound <prefix>-<role>` blocks, all in the
project's voice, all sharing the cohering trait. Save them; the
next step writes the `.acs` file with them at the top followed
by selector bindings.

### Anti-pattern: overrunning into 20+ presets

Resist the temptation to design a preset for every event class
the runtime supports. The page has 5–10 actual interaction
flavors; design 5–10 presets. More is noise.
