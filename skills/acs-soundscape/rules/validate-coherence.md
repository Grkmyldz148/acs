---
title: Enforce a coherent preset family
impact: HIGH
impactDescription: A soundscape is a family of related sounds, not a sample pack. Drift between presets reads as confusion.
tags: validate, coherence, family
---

## Enforce a coherent preset family

The custom `@sound` blocks in one `.acs` file must share at least
one stylistic trait. Without it, the soundscape sounds like
random samples bolted together, even if each preset individually
is well-designed.

### The rule

Identify which cohering trait you committed to in
`pipeline-author-customs` Step 4. Then verify every custom
preset honors it.

Acceptable cohering traits:

1. **Shared fundamental band** — all body fundamentals fall
   within a 1.5× ratio. Example: 800–1200 Hz family. A preset
   with body at 220 Hz breaks the family.
2. **Shared attack character** — all click attacks fall within
   a 3× ratio. Example: 0.5–1.5 ms (sharp family). A preset
   with `attack: 8 ms` breaks it.
3. **Shared decay range** — all click decays within 2× of each
   other. Example: 30–60 ms (snap family). A preset with
   `decay: 200 ms` (without a justified reason — page-enter
   is allowed to be longer) breaks it.
4. **Shared filter signature** — every preset uses the same
   filter type with cutoffs in a narrow band. Example: every
   noise layer uses `bandpass` at 2 kHz Q 0.8.
5. **Shared layer recipe** — every preset is body + click, OR
   every preset is single-layer additive sines, OR every preset
   uses `pluck:` primitives. Mixing recipes only works when one
   of the others (1–4) is also enforced.

### Why this trait must be declared up front

If you check after the fact, you'll backsolve into a coherence
that wasn't intentional. Declaring it in Step 4 forces the
authoring to converge instead of diverge.

### Enforcement procedure

1. Read the cohering trait from your authoring notes.
2. For each custom `@sound`:
   - Extract the relevant parameter(s) from the body / click layers.
   - Test: does it fall in the declared range?
3. List violations. For each:
   - Is the deviation **intentional** and **justified** (e.g.
     "page-enter is allowed a 600 ms decay because the visual
     transition is also 600 ms" — fine)?
   - If not, the preset must be reworked.

A soundscape with one or two intentional outliers is fine —
they become the *signature events*. A soundscape where half
the presets are outliers has no family.

### What you produce

PASS, or a list of presets that drift from the declared trait
and a directive to either rework them or update the declared
trait if the new direction is genuinely better.

### Anti-pattern

Declaring "all presets are warm" as the cohering trait.
"Warm" is not measurable. Coherence traits must reduce to
a numeric range or a syntactic fact (same primitive, same
filter type). Vibe-coherence is what you get *for free* once
the family is numerically tight.
