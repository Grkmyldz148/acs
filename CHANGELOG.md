# Changelog

All notable changes to ACS. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely; phases
correspond to internal development milestones.

## [Unreleased]

## [0.9.5] — 2026-05-05

### Fixed
- **Bundler / CDN compatibility.** `dist/runtime.mjs` no longer contains
  `new URL("../defaults.acs", import.meta.url)` or
  `new URL("./worklets/click-processor.js", import.meta.url)`. Both
  expressions tripped webpack/vite asset resolution at consumer build
  time (`Module not found: defaults.acs` errors when doing
  `import 'acs-audio'` from Next.js, CRA, etc.) and also failed at
  runtime on CDNs that don't serve `.acs` with permissive CORS — unpkg
  in particular returns no `Access-Control-Allow-Origin` header for
  unknown extensions, blocking the auto-load fetch.
- The bundler (`tools/bundle.mjs`) now inlines `defaults.acs` content
  as a string constant and the AudioWorklet source as a Blob URL, so
  the published runtime is fully self-contained. Saves one HTTP
  round-trip on first load and fixes both `<script type="module">` and
  `import 'acs-audio'` paths simultaneously. Dev mode (poc/ served
  directly) keeps the URL-fetch behavior — only the published bundle
  is rewritten.
- Bundler now fails the build if the forbidden patterns survive the
  rewrite, so this regression cannot reach the registry again.

## [0.9.4] — 2026-05-04

### Added
- **Components gallery** gains four new ACS edge-case demos: Stepper
  (pitch direction), Carousel (custom @sound + directional pitch),
  Hold-to-confirm (gesture state cycle), Mood scope (genuine cascade
  inheritance via [data-mood]).
- **Custom `@sound carousel-slide`** in `landing.acs` — pink-noise
  body with a bandpass cutoff sweep + high-pass click.
- **Sound-mood character expansion** — every mood profile now layers
  on character-changing nodes that filters alone can't produce:
  `bitcrush` (retro 4-bit, lofi 6-bit), `ringmod` (metallic, 287 Hz
  60 % wet), `noise` floor (lofi cassette pink hiss), plus
  considerably more aggressive filter+saturation values.
- **Docs search modal** with Cmd+K / `/` shortcuts, fuzzy match
  across sidebar items + section snippets, keyboard nav.
- **Auto copy buttons** on every `<pre>` in the docs article — hover-
  revealed top-right, shared bottom-center toast.
- **Global toast** (`window.acsToast`) used by Install copy, Hero
  copy card, and any future single-shot confirmation surface.
- **Mobile hamburger drawer** with full-bleed overlay, escapes the
  nav stacking context, body-scroll locked while open.
- **Hide-on-scroll header** — iOS-Safari-style, position fixed,
  ref-based DOM class toggle (no per-frame React render).
- **`Grkmyldz148/acs-skills` mirror repo** with GitHub Actions
  auto-sync from `skills/create-acs-sound/`. Users install via
  `npx skills add Grkmyldz148/acs-skills` (no path).
- **1200×630 spec-correct OG card** at `landing/og-image.png`.

### Fixed
- **Mood inheritance demo** — preset buttons now have `data-preset`
  attributes bound via cascade in `landing.acs`; the previous JS
  `play()` helper bypassed the DOM walk and stripped the inherited
  `sound-mood`. Now the mood actually applies through the cascade.
- **Carousel sound** — replaced `swoosh` preset call with the new
  custom `@sound carousel-slide` triggered through cascade.
- **Sticky sidebar / TOC** in docs — `body { overflow-x: hidden }`
  was making body the containing block for `position: sticky`
  descendants, silently downgrading them to static. Moved the
  horizontal-scroll clamp to `<html>` only.
- **CTA buttons** trimmed from 36 → 32 px height to match the rest
  of the action-row vocabulary; npm button added.
- **AudioContext lazy-creation** — `bindAll()` now stashes `:root`
  master decls instead of eagerly calling `ensureCtx()`. The audio
  context builds at first user-driven trigger; pending master decls
  flush at that point. Eliminates Chrome's autoplay-policy warning.

## [0.9.3] — 2026-05-04

### Fixed
- **AudioContext autoplay warning** — `bindAll` no longer eagerly creates
  the AudioContext at parse time. The runtime now stashes `:root` master
  decls and flushes them on the first real user-driven trigger, side-
  stepping Chrome's autoplay-policy console warning that fired on every
  page load.
- **`>`, `+`, `~` selector handling** — when an unsupported combinator
  appears in an `.acs` rule, the runtime warns and treats it as
  descendant. Updated `landing.acs` to use the supported descendant
  syntax instead of the silently-broadened `>`.

## [0.9.2] — 2026-05-04

### Added
- **`audiocss.dev`** — public landing site live, with full developer
  documentation at `/docs/`. Sticky sidebar nav, on-page TOC, zinc
  design tokens, eats-its-own-dog-food sound design.
- **VSCode Marketplace publish** — extension now searchable as **ACS**
  in VSCode's extension panel. Same package on Open VSX (Cursor /
  VSCodium / Theia / Gitpod).
- **`skills/create-acs-sound/`** — Claude / Cursor agent skill that
  composes 48 atomic rules across pipeline /
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
