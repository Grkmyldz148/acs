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
