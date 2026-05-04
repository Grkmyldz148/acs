# create-acs-sound

> AI agent skill — generate ACS `@sound` blocks from prompts or audio files.

This is a Claude / Cursor agent skill that helps you (or an AI assistant
running on your behalf) author ACS sound presets. Instead of hand-writing
a `@sound` block, you describe what you want in English, and the skill
walks a deterministic pipeline that picks a base layer, applies mood
adjectives, and emits a calibrated, paste-ready ACS preset.

The skill is built around an atomic-rule pattern: every decision the
agent has to make (pick a base layer, apply a mood, validate a gain
budget) is its own short markdown file under `rules/`, and `SKILL.md`
orchestrates them. The output format is ACS's declarative DSL —
`@sound name { layer { source: …, decay: …, gain: … } }`.

## What it does

Given any of the following inputs, the skill produces a paste-ready
ACS `@sound` block:

| Input                          | Pipeline                                                                |
| ------------------------------ | ----------------------------------------------------------------------- |
| Prompt only                    | `event-*` matching → `mood-*` mutation → `layer-*` shaping → emit       |
| Audio file only                | `interpret-*` (FFT, envelope, spectral) → emit reconstructed `@sound`   |
| Prompt + audio                 | Run `interpret-*`, then treat prompt adjectives as a refinement layer   |

Optional follow-up:

- **Render preview**: offline-render the result to a WAV via the same
  Web Audio engine the runtime uses (`analyzer/render.mjs`).
- **Round-trip validate**: re-analyze the rendered WAV and diff measured
  vs. intended values within the tolerance bands declared in
  `validate-*` rules.

## Install

This skill is just a directory of markdown rules — no install required.
Point your agent runtime at:

```
skills/create-acs-sound/SKILL.md
```

For Claude Code: copy the directory into `~/.claude/skills/` or
reference it via repo path. For Cursor: point the agent at the same
path. The `metadata.json` lets agent runtimes auto-discover the skill.

## Layout

```
create-acs-sound/
├── SKILL.md              orchestrator (auto-built from rules/*.md)
├── README.md             this file
├── metadata.json         agent-runtime descriptor
├── package.json          npm scripts (build, validate, extract-tests)
├── test-cases.json       prompt → expected @sound fixtures
├── rules/
│   ├── _sections.md      table-of-contents headings for build.mjs
│   ├── _template.md      copy this when adding a new rule
│   ├── pipeline-*.md     orchestration steps (5 rules)
│   ├── event-*.md        event-class base layers (10 rules)
│   ├── mood-*.md         mood adjective mutations (9 rules)
│   ├── layer-*.md        single vs multi-layer shapes (4 rules)
│   ├── effect-*.md       reverb/filter/saturation recipes (5 rules)
│   ├── interpret-*.md    audio analysis sub-steps (5 rules)
│   └── validate-*.md     output validation tolerances (5 rules)
└── src/
    ├── build.mjs         concatenate rules/*.md → SKILL.md
    ├── lib.mjs           shared helpers (ACS emit, frontmatter parse)
    ├── validate.mjs      check rule frontmatter + example syntax
    └── extract-tests.mjs scrape test-cases.json from rule examples
```

## Authoring a new rule

```bash
cp rules/_template.md rules/event-my-thing.md
# edit frontmatter (title, impact, tags, prompt, example) + body
node src/build.mjs        # rebuilds SKILL.md
node src/validate.mjs     # checks the new rule conforms
```

`example` in the frontmatter must be a valid ACS snippet (a `@sound`
block or a fragment of one). `validate.mjs` round-trips it through the
ACS parser to catch syntax errors at authoring time.

## Why this format

The format is deliberately built around atomic decision documents —
each one independently addressable, composed by a thin orchestrator —
because that mental model works well for AI agents.
The agent doesn't need to load all 1500 lines at once; it can read the
section of `SKILL.md` that describes the current pipeline step, find
the relevant `rules/*.md` files referenced, and decide. Agents stay in
the right context window.

It also makes the skill **testable**: each rule's `example` is a
test fixture; `extract-tests.mjs` rolls them up into a JSON suite.

## License

MIT — same as the parent project.
