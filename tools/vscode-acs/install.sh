#!/usr/bin/env bash
# Installs the ACS language extension into VSCode and/or Cursor.
#
# Modern VSCode/Cursor do not auto-load extensions copied directly into
# ~/.{vscode,cursor}/extensions/ — they must be registered via the editor
# CLI (which packages them, writes the publisher.id folder name, and
# updates extensions.json). This script does that for you.
#
# Usage:
#   cd tools/vscode-acs && ./install.sh
#
# Optional env vars:
#   ACS_VSIX_OUT=/some/path.vsix   write the built vsix here (default: /tmp)
#   ACS_SKIP_VSCODE=1              skip the VSCode install
#   ACS_SKIP_CURSOR=1              skip the Cursor install

set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(node -p "require('$SRC/package.json').version")"
VSIX_OUT="${ACS_VSIX_OUT:-/tmp/acs-language-${VERSION}.vsix}"

echo "→ Packaging acs-language ${VERSION}"
(
  cd "$SRC"
  npx --yes @vscode/vsce@latest package \
    --skip-license --no-yarn --no-dependencies \
    -o "$VSIX_OUT" >/dev/null
)
echo "  ✓ $VSIX_OUT"

# --- Locate IDE CLIs --------------------------------------------------------
# `code` is installed by VSCode → "Shell Command: Install 'code' command".
# `cursor` is installed by Cursor → command palette "Install 'cursor' command".
# If the CLI isn't on PATH we try the in-app binary directly.

resolve_cli() {
  local name="$1" app_path="$2"
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  if [ -x "$app_path" ]; then
    echo "$app_path"
    return 0
  fi
  return 1
}

VSCODE_CLI="$(resolve_cli code   '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'   || true)"
CURSOR_CLI="$(resolve_cli cursor '/Applications/Cursor.app/Contents/Resources/app/bin/cursor'             || true)"

# --- Install ----------------------------------------------------------------

install_via_cli() {
  local label="$1" cli="$2" hint="$3"
  if [ -z "$cli" ]; then
    echo "→ ${label}: CLI not found, skipping"
    echo "    (${hint})"
    return
  fi
  echo "→ Installing into ${label} via $cli"
  "$cli" --install-extension "$VSIX_OUT" --force
}

[ "${ACS_SKIP_VSCODE:-0}" = "1" ] || install_via_cli \
  "VSCode" "$VSCODE_CLI" \
  "open VSCode → Cmd+Shift+P → \"Shell Command: Install 'code' command\""

[ "${ACS_SKIP_CURSOR:-0}" = "1" ] || install_via_cli \
  "Cursor" "$CURSOR_CLI" \
  "open Cursor → Cmd+Shift+P → \"Shell Command: Install 'cursor' command\""

echo ""
echo "Done. Restart any open .acs editors to pick up the language."
