# ACS — VSCode Language Support

Minimal VSCode extension that registers `.acs` files as their own
language with syntax highlighting and a custom file icon.

## Install

```bash
cd tools/vscode-acs && ./install.sh
```

The script packages the extension into a `.vsix` and installs it via
each editor's CLI (`code` for VSCode, `cursor` for Cursor). This is the
**only** install path that works on modern VSCode/Cursor — copying
folders into `~/.{vscode,cursor}/extensions/` no longer auto-loads the
extension because `extensions.json` won't be updated.

If a CLI isn't on your PATH, the script tells you exactly which command
palette action to run inside the editor (`Shell Command: Install 'code'
command`, `Shell Command: Install 'cursor' command`). Re-run after.

After restart, `.acs` files should:
- Show a custom waveform icon in the file explorer
- Highlight selectors, properties, units, at-rules, presets, units
- Auto-close brackets and quotes
- Format on `Shift+Alt+F`

### Manual install (any VSCode-derivative)

The build artifact is a standard `.vsix` and works in every
VSCode-compatible editor:

| Editor                | CLI command |
|-----------------------|-------------|
| VSCode                | `code --install-extension /tmp/acs-language-X.Y.Z.vsix` |
| Cursor                | `cursor --install-extension /tmp/acs-language-X.Y.Z.vsix` |
| VSCodium / Code-OSS   | `codium --install-extension …` |
| Windsurf              | `windsurf --install-extension …` |
| Theia                 | drop the `.vsix` into the Extensions view |

Or in any of them: `Cmd+Shift+P → "Extensions: Install from VSIX..."`
and pick the `.vsix` produced by `./install.sh`.

### Other editors (using the same grammar)

The grammar at `syntaxes/acs.tmLanguage.json` is portable TextMate JSON
and can be reused across editors:

- **JetBrains IDEs** (IntelliJ, WebStorm, PhpStorm, RustRover…) —
  Settings → *Editor* → *TextMate Bundles* → **+** → point at this
  `tools/vscode-acs/` folder. JetBrains will load the grammar as a
  TextMate bundle. Then Settings → *Editor* → *File Types* → associate
  `*.acs` with the new "ACS" type if it didn't auto-bind.
- **Sublime Text** — copy `syntaxes/acs.tmLanguage.json` to
  `~/Library/Application Support/Sublime Text/Packages/User/` (rename to
  `acs.sublime-syntax` not required — Sublime reads `.tmLanguage.json`
  directly).
- **Neovim / Vim** — easiest is `set filetype=css` for `.acs` files
  (most ACS syntax is CSS-shaped):
  ```vim
  autocmd BufRead,BufNewFile *.acs set filetype=css
  ```
  Drop into `~/.config/nvim/init.vim` or `init.lua` equivalent.
- **Zed / Helix** — both want tree-sitter grammars; not yet provided.
  Same CSS-fallback trick works:
  ```toml
  # ~/.config/helix/languages.toml
  [[language]]
  name = "css"
  file-types = ["css", "acs"]
  ```
- **GitHub.com syntax highlighting** — requires submitting the grammar
  to [github-linguist](https://github.com/github-linguist/linguist).
  Not done yet.

## What's covered

- `@sound`, `@media`, `@sound-keyframes` at-rules
- All known top-level properties + layer keys
- Selectors (tag, class, attribute, pseudo-states)
- Numeric units (hz, khz, ms, s, st, dB)
- Built-in keywords (sine/square/saw/triangle, modal, pluck, room
  presets, mood values, filter types)
- Document formatter (Shift+Alt+F)
- Context-aware completion + hover
- **Sound Picker** — mini DAW webview for designing `@sound` blocks
  by ear instead of by typing

## Sound Picker

`Cmd+Shift+P → ACS: Open Sound Picker` (or click the icon in the
editor title bar of any `.acs` file). The picker is built around
a four-step Easy mode that lets non-experts design sounds without
ever touching a Hz value, plus a Pro mode that exposes every raw
DSP parameter for surgical control.

### Easy mode

1. **Pick a starting point** — browse 40+ built-in presets in a
   gallery grouped by category (clicks, bells, notifications,
   transitions, toggles, strings, percussion, status). Or skip the
   gallery and pick a use case ("button click", "modal opens",
   "delete / dismiss") from the dropdown — it picks a sensible
   starter for you.
2. **Shape it** — five subjective sliders, each driving multiple
   raw parameters under the hood:
   - **pitch** — transposes fundamentals one octave per unit
   - **tone** — darkens/brightens (filter cutoff, upper-partial mix,
     FM depth, pluck brightness)
   - **length** — halves/doubles all decays
   - **snap** — softens/sharpens the attack
   - **texture** — adds soft-clip saturation
   Double-click a slider to reset it to neutral.
3. **Add character** (optional) — pick one of nine moods (warm,
   bright, glassy, metallic, organic, punchy, retro, airy, lofi).
   The mood is baked into the layer parameters so the emitted
   `@sound` block is self-contained.
4. **Try variations** — 🎲 surprise me generates five randomized
   versions of the current sound. ▶ to audition, double-click to
   apply.

### Pro mode

Click ⚙ pro mode to reveal the full layer editor — each layer
exposes its raw parameter set (modal ratios/decays/gains, FM
ratio/depth, brightness, attack/decay envelopes, drive, pan, q,
cutoff, etc.). Editing in Pro mode promotes the current derived
layers to the new baseline and resets macros to neutral, so
switching back to Easy mode treats your edits as the new starting
point.

### Output

- Live code preview shows exactly the `@sound` text you'd write by hand
- ▶ Play auditions the full sound; per-layer ▶ in Pro mode auditions
  one layer alone
- ⤓ Insert appends the block at the end of the current line in the
  active `.acs` editor; 📋 Copy puts it on the clipboard
- ↺ Reset reverts to the chosen archetype with macros at neutral

State persists between panel reopens within the session.

## Limitations

The grammar is TextMate-based. Diagnostics still come from the
CLI linter (`tools/lint-acs.mjs`). The Sound Picker mirrors the
runtime DSP (modal IIR, Karplus-Strong pluck, FM osc, filtered
noise) sample-accurately, but room reverb is not applied in
preview — that happens at runtime and depends on the final
stylesheet's `:root` config.
