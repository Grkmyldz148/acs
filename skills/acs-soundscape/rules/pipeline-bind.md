---
title: Bind selectors and write the .acs file
impact: HIGH
impactDescription: Even great presets are wasted if the bindings are sloppy. The cascade is part of the identity.
tags: pipeline, bind, cascade
---

## Bind selectors and write the .acs file

The output of this step is a single `.acs` file the project can
ship. Order matters.

### File structure

```
/* <project name> — ACS soundscape
 * <2-line summary of identity statement>
 */

:root {
  master-volume: <number based on copy tone — see below>;
  room: <none|small-room|medium-room>;
  /* additional :root inheritance only via body block */
}

body {
  /* properties that need to inherit (pitch, mood, pan) live here,
     not in :root — see :root inheritance pitfall in defaults */
}

/* ====== custom @sound blocks (the soundscape family) ====== */

@sound <prefix>-<role-1> { ... }
@sound <prefix>-<role-2> { ... }
...

/* ====== bindings ====== */

<selectors organized by interaction class>
```

### Volume budget by copy tone

| Copy voice                       | master-volume |
|----------------------------------|---------------|
| Terse, technical, dry            | 0.45–0.55     |
| Editorial, calm, considered      | 0.50–0.60     |
| Warm, friendly, inviting         | 0.55–0.65     |
| Playful, energetic               | 0.60–0.70     |
| Brutalist, loud, confrontational | 0.70–0.85     |

The volume budget is a personality dial. A trading platform at
0.7 sounds like a chaotic crypto site. A children's app at 0.45
sounds afraid of itself.

### Selector organization

Group bindings by interaction class, not by element type. Each
group gets a comment explaining which preset(s) it triggers and
why those are the right fit.

```
/* Page enter — phosphor warm-up; identity-defining moment */
main { sound-on-appear: caret-power-on; volume: 0.6; }

/* Primary action — the click that ships the user forward */
button.primary,
nav a[href="#cta"] {
  sound-on-enter: caret-tick;     /* hover */
  volume: 0.3;
}
button.primary:on-click,
nav a[href="#cta"]:on-click {
  sound: caret-confirm;
  room: none;                       /* identity is dry on commits */
}

/* Secondary actions — same hover, different click */
nav a:not([href="#cta"]),
footer a {
  sound-on-enter: caret-tick;
  volume: 0.22;
}
nav a:not([href="#cta"]):on-click,
footer a:on-click {
  sound: caret-tap;
}
```

### Use the cascade — don't author 10 near-identical presets

If the same preset works in two contexts with different
personality, override `pitch`, `volume`, `room`, or `sound-mood`
at the binding rather than authoring two presets:

```
@sound caret-tap { ... }      /* one preset */

button { sound-on-click: caret-tap; }                      /* default voice */
nav a:on-click { sound: caret-tap; volume: 0.7; pitch: -2st; } /* lower, quieter */
#cta button:on-click { sound: caret-tap; pitch: +1st; }    /* higher, the win */
```

This mirrors how real CSS uses one `--accent` variable across
many elements with overrides — economical and coherent.

### Defaults — only with rationale

If you bind a runtime default preset, the line MUST carry a
comment explaining why this default fits this project's voice.
Without the comment, the validator rejects the file.

```
/* `complete` chord matches the 3-note chime in the brand jingle
   used in the demo video; reusing it here makes the audio identity
   continuous across surfaces. */
form.checkout:on-submit { sound: complete; }
```

A binding to `tap-tactile` without explanation is the failure
mode this skill exists to prevent.

### What you produce

The complete `.acs` file. Show it to the user before saving.
Include in the response:
- The path you'll write to (e.g. `public/site.acs`)
- The `<link rel="audiostyle" href="/site.acs">` snippet for `<head>`
- A reminder to load `acs-audio` runtime (npm or `<script type="module">`)
