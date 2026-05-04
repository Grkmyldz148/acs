# Changelog

All notable changes to ACS. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely; phases
correspond to internal development milestones.

## [Unreleased]

## [0.9.2] — 2026-05-04

### Added
- **`audiocss.dev`** — public landing site live, with full developer
  documentation at `/docs/`. Sticky sidebar nav, on-page TOC, zinc
  design tokens, eats-its-own-dog-food sound design.
- **VSCode Marketplace publish** — extension now searchable as **ACS**
  in VSCode's extension panel. Same package on Open VSX (Cursor /
  VSCodium / Theia / Gitpod).
- **`skills/create-acs-sound/`** — Claude / Cursor agent skill mirroring
  `@web-kits/audio`'s `create-sound`. 48 atomic rules across pipeline /
  event / mood / layer / effect / interpret / validate categories,
  `src/build.mjs` regenerates `SKILL.md` from rules, lightweight
  validator (`src/validate.mjs`) round-trips every example through an
  ACS sanity check.
- **Helm-lab color palette** — landing CSS rebuilt around perceptually
  uniform monochrome (chroma 0) with a single saturated accent.
  Credit + link in the footer.
- **`gorkemyildiz.com` author attribution** in landing footer + READMEs.

### Changed
- 512 px transparent publisher icon for the VSCode/Open VSX listings
  (was 128 px scaled-up bitmap).
- README VSCode-extension section now links the actual marketplace
  listings instead of pointing only at the GitHub `.vsix`.

## [0.9.1] — 2026-05-04

### Fixed
- **npm package layout** — `dist/runtime.mjs` resolves
  `new URL("../defaults.acs", import.meta.url)` against its own bundler
  location, so `defaults.acs` and `worklets/click-processor.js` need to
  live next to the runtime in `dist/`. The 0.9.0 publish only shipped
  them under `poc/`, so consumers installing through `npm install
  acs-audio` lost the entire 49-preset library at runtime. Bundler now
  mirrors both into `dist/` at build time.



Picker layer editor: knob-based DSL editor for the @sound block of any
preset. Source dropdown, freq, ratios/decays/gains text inputs, FM
modulator (osc layers), pitch-from sweep, detune, brightness (pluck),
filter + cutoff, attack/decay, gain/drive/pan/start. Live waveform
preview at top of editor; drag-to-reorder layers; Reset to original;
Copy as `@sound` for paste-ready output.

Layer editor exposes `window.ACS.makeSoundFromLayers` so hosts can
register synthesized presets without re-binding the cascade. Auditioning
no longer wipes other custom presets.

VSCode extension v0.9.0: outline (DocumentSymbol), folding, document
links, ▶ Audition CodeLens (in addition to Open in Picker), 30+ new
snippets covering bell / FM-bell / snare / kick / pluck / fast-tap
recipes plus cascade blocks for buttons / toasts / switches / inputs /
dialogs.

## [0.9.0] — 2026-05-03

### Added
- **CSS-var bridge** — `var(--token)` works in any ACS value. Numeric
  parsers (`parseFreq` / `parseTime` / `parsePitch` / `parseVolume`)
  resolve via `getComputedStyle(documentElement)` before parsing. String
  decls (`sound`, `room`, `mood`) resolved at trigger entry.
- **`window.ACS.devtools`** — opt-in introspection overlay. `mount()`
  renders a fixed-position panel with the last 20 triggers + preset /
  source / factor / mood / room state. Subscribes via `onTrigger`.
- **`window.ACS.helpers`** — programmatic adapters: `play(name, opts?)`,
  `attach(el, name, event?)`, `useSound(hooks, name, opts?)`. The hook
  takes `{ useCallback }` injection so the runtime has no React peer.
- **`@sample <name> url("...")`** — body-less at-rule that registers
  audio file URLs under preset names. Fetched + cached on first trigger.
- **8 themes** — added `cinematic`, `bauhaus`, `terminal`, `ambient`
  alongside the original `apple`, `material`, `retro`, `brutalist`.
- **Phase 9 — naming finalized** as **ACS — Audio Cascading Style
  Sheets**. The 2026-05-03 `ACSS` → `ACS` migration is recorded in
  `calibrate.js`'s cache-version sweep.

## [0.8.x] — Worklet, quality, mood-mix, linter

### Added
- **AudioWorklet voice processor expansion** — 4 kinds (sine, noise,
  modal, pluck). `realtime: true` opt-in on simple layers routes through
  the worklet for sub-1 ms latency. Falls back to main-thread when
  unavailable.
- **`quality: low | medium | high`** on `:root`. Caps voice pool at 4 /
  8 / 16 voices, modal partials at 3 / 16 / 16, reverb tail length at
  0.6× / 1.0× / 1.0×.
- **`sound-mood-mix: 0..1`** wet/dry blend for `sound-mood`. Cached fast
  path when mix=1; explicit dry/wet split when mix<1.
- **`!important`** parsing on values, two-pass cascade merge.
- **VSCode/Cursor extension** — language grammar, formatter, completion,
  hover docs, CodeLens "Open in Picker", live linter
  (`DiagnosticCollection`), 20+ snippets.
- **Sound picker** — intent-based browser with hover-preview, keyboard
  navigation, inline tweak bar, ASCII-bar thumbnails (cached in
  localStorage). Embedded into the VSCode extension as a webview.

### Improved
- **Calibration spread** tightened from 7.2 dB → 4.8 dB. Added
  `PRESET_TARGET_MULT` table for within-class outliers that class-level
  budgets can't reach.
- **`tools/bundle.mjs`** correctly handles `import * as ns from` and
  `import { x as y } from` — prior bundles silently dropped namespace
  imports.

## [0.7.x] — Tooling

### Added
- `compile-acs.mjs` precompiler, `bundle.mjs` runtime bundler,
  TypeScript definitions, `package.json` npm exports.

## [0.6.x] — Themes + delegation

### Added
- Theme packs (4 initial: Apple / Material / Retro / Brutalist).
- Document-level event delegation refactor.
- `validate.js` fuzzy-match warnings.

## [0.5.x] — Mood overlays

### Added
- `sound-mood` as inheritable property — 9 mood overlays (warm, bright,
  glassy, metallic, organic, punchy, retro, airy, lofi).

## [0.4.x] — DSP polish

### Added
- PolyBLEP-equivalent oscillators (PeriodicWave cache).
- TPT-SVF filter (`tpt-*`).
- Dattorro plate reverb (`room: plate`).
- Voice pool / polyphony cap with oldest-fade voice stealing.
- AudioWorklet click processor + `latencyHint: 'interactive'`.

## [0.3.x] — Selectors

### Added
- Universal `*`, attribute selectors, descendant combinator,
  compound classes, specificity tiers.
- `@sound-keyframes` + `sound-sequence` for multi-step sounds.
- `@media (input-modality)` query.

## [0.2.x] — Per-element room

### Added
- Per-element `room:` override, lazy room chains.
- Nested `@media`, `prefers-reduced-sound` accessibility fallback.

## [0.1.x] — Auto-calibration

### Added
- Offline pre-render auto-loudness pipeline (K-weighted RMS,
  per-class budget, baked factors). `volume: X !raw` bypass.

## [0.0.x] — Foundations

### Added
- Parser, cascade, master chain.
- Modal IIR / Karplus-Strong / FM / noise primitives.
- Built-in `defaults.acs` preset library.
- Modular runtime split (parse / cascade / audio / dsp / dom / mood /
  voicepool / calibrate / throttle / validate / quality).
