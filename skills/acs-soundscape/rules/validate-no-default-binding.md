---
title: Reject default-preset bindings without rationale
impact: CRITICAL
impactDescription: This is the validator that catches generic-output failure mode. Without it the skill regresses to "drop tap-tactile on every button".
tags: validate, defaults, rationale
---

## Reject default-preset bindings without rationale

The runtime ships ~49 default presets in `poc/defaults.acs`
(names like `tap`, `tap-tactile`, `tick`, `pop`, `click`, `confirm`,
`pop`, `success`, `bell`, `chime`, etc.). Reusing these as the
binding for a project's primary interactions defeats the entire
purpose of this skill.

### The rule

Every `sound:` / `sound-on-*:` declaration in the output `.acs`
file must satisfy ONE of:

1. The preset name is a project-prefixed custom (`<prefix>-<role>`),
   defined as an `@sound` block earlier in the file.
2. The line carries a comment on the preceding line or trailing the
   declaration explaining why this default fits this project's
   voice.

**Examples that pass:**

```css
button:on-click { sound: caret-tap; }    /* custom — passes */

/* `complete` chord matches the 3-note jingle in our launch video,
   reused here for cross-surface continuity. */
form.checkout:on-submit { sound: complete; }   /* default with rationale — passes */
```

**Examples that fail:**

```css
button:on-click { sound: tap-tactile; }       /* default, no rationale — FAILS */
nav a:on-click { sound: tick; }               /* default, no rationale — FAILS */
```

### Quantitative budget

If the file contains custom `@sound` blocks but more than 40% of
the bindings use defaults (with or without rationale), the file
fails. The skill exists to author custom soundscapes; majority-
default output means the inventory and authoring steps were
skipped.

### Enforcement procedure

When you finish writing the `.acs` file, scan it:

1. Count all `sound:` and `sound-on-*:` declarations. Call this `N`.
2. For each one:
   - Is the value a custom (matches an `@sound <name>` defined above
     in the same file)? Mark **custom**.
   - Else, does the line above (or trailing) contain `/* … */` text?
     Mark **default-with-rationale**.
   - Else, mark **default-bare** — this is a failure.
3. Compute `default-bare > 0`? FAIL — fix every flagged line.
4. Compute `(default-with-rationale + default-bare) / N > 0.40`?
   FAIL — author more customs.

### Why this matters

A user opening their newly-sounded site for the first time should
hear something that fits **their** project. If they hear the same
"tap-tactile" they've heard on three other random sites, the
soundscape becomes invisible — the opposite of the goal. The
custom `@sound` family is what makes the site sonically theirs.

### What you produce

Either: PASS, with the file unchanged. Or: a list of failing
lines and a directive to revisit `pipeline-author-customs` for
the missing presets.
