---
title: Validate — schema conformance
impact: HIGH
impactDescription: A typo'd preset name silently fails. A typo'd property name silently fails. Catch them early.
tags: validate, schema, parser
prompt: ""
example: |
  /* OK — every key is in the schema */
  @sound ok {
    body { osc: sine; freq: 880hz; decay: 200ms; gain: 0.3; }
  }

  /* FAIL — 'frequecny' is a typo; runtime ignores the key, layer plays at default 440hz */
  @sound typo {
    body { osc: sine; frequecny: 880hz; decay: 200ms; gain: 0.3; }
  }
---

## Validate — schema conformance

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
