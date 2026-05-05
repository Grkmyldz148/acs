---
title: Enforce project-prefixed preset names
impact: HIGH
impactDescription: Naming presets `tap` or `click` (no prefix) is one rename away from a default-binding regression. Prefixes prevent that.
tags: validate, naming, prefix
---

## Enforce project-prefixed preset names

Every custom `@sound` block in the output `.acs` file must carry
a project-specific prefix. The prefix is established in
`pipeline-author-customs` (Step 2).

### The rule

```
@sound <prefix>-<role>
```

`<prefix>` is 3+ characters derived from the project name.
`<role>` is the interaction role (`tap`, `confirm`, `power-on`,
`page-enter`).

### Examples that pass

```
@sound caret-tap { ... }
@sound caret-power-on { ... }
@sound forge-anvil { ... }
@sound vox-snap { ... }
```

### Examples that fail

```
@sound tap          { ... }   /* no prefix — collides with default */
@sound my-tap       { ... }   /* generic prefix — same on every project */
@sound custom-click { ... }   /* "custom" is a prefix that means nothing */
@sound sound1       { ... }   /* placeholder — clearly skipped naming */
```

### Why prefixes matter

1. **Prevents accidental override.** ACS resolves a `sound:` value
   by looking up the name in `customPresets` first, then in the
   built-in `presets`. An `@sound tap { }` shadows the runtime's
   `tap` preset across the entire page — a footgun. Prefixing
   eliminates the collision.
2. **Forces a moment of identity decision.** The instant you type
   `caret-` you're committing the soundscape to the project's
   voice. Without a prefix, you can pretend the preset is generic
   and reusable, which leads to vague design.
3. **Surfaces the soundscape in stack traces / inspector.** When
   a developer is debugging audio, `caret-confirm` in the
   stylesheet tells them what's playing. `confirm` could be
   built-in or local — they have to read the file to know.

### Enforcement procedure

When the `.acs` file is written:

1. Parse all `@sound <name> { ... }` blocks.
2. For each name:
   - Does it contain a `-` after the first 3+ chars? If not, FAIL.
   - Is the prefix on a denylist (`my-`, `custom-`, `new-`, `temp-`,
     `test-`, `sound`, `ui-`)? If yes, FAIL.
   - Is the prefix the same as any built-in preset name from
     `defaults.acs`? If yes, FAIL.
3. Either PASS, or list the failing names and direct back to
   Step 2 of `pipeline-author-customs` to pick a real prefix.

### What you produce

PASS, or the failing names + a suggested prefix derived from
the inventory note's product name.
