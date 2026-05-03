#!/usr/bin/env node
/* build-webview-picker.mjs — Bundle poc/picker.html for the VSCode webview.
 *
 * Reads:
 *   - poc/picker.html              the master picker source
 *   - dist/runtime.mjs             bundled runtime (build via tools/bundle.mjs first)
 *   - poc/defaults.acs             built-in preset library
 *
 * Transforms:
 *   - Replaces `<script type="module" src="runtime.js">` with an inline
 *     `<script type="module">` containing dist/runtime.mjs. The runtime's
 *     fetch() calls for defaults.acs are intercepted by injecting a
 *     pre-loaded text into a `<script type="text/acs">` block + a
 *     fetch shim.
 *   - Removes `<link rel="audiostyle" href="defaults.acs" />` (the inline
 *     fetch shim covers it).
 *
 * Output:
 *   - tools/vscode-acs/webview/picker.html  fully self-contained, no
 *                                             external file needed
 *
 * Run: node tools/build-webview-picker.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PICKER_SRC = resolve(ROOT, "poc/picker.html");
const RUNTIME_BUNDLE = resolve(ROOT, "dist/runtime.mjs");
const DEFAULTS_ACS = resolve(ROOT, "poc/defaults.acs");
const OUT = resolve(ROOT, "tools/vscode-acs/webview/picker.html");

if (!existsSync(RUNTIME_BUNDLE)) {
  console.error(`[build-webview-picker] missing ${RUNTIME_BUNDLE}`);
  console.error("Run `node tools/bundle.mjs` first.");
  process.exit(1);
}

const html = readFileSync(PICKER_SRC, "utf8");
const runtime = readFileSync(RUNTIME_BUNDLE, "utf8");
const defaults = readFileSync(DEFAULTS_ACS, "utf8");

// Inline the runtime as a module script. Wrap in a try/catch so we can
// see startup errors in the webview console.
const runtimeBlock =
  `<!-- inlined runtime + defaults.acs (by tools/build-webview-picker.mjs) -->\n` +
  `<script id="acs-defaults" type="text/acs">\n` +
  defaults.replace(/<\/script>/g, "<\\/script>") + `\n</script>\n` +
  `<script>\n` +
  `// fetch() shim: intercept defaults.acs requests, return embedded text.\n` +
  `(function(){\n` +
  `  const origFetch = window.fetch;\n` +
  `  const defaultsText = document.getElementById("acs-defaults").textContent;\n` +
  `  window.fetch = function(url, opts){\n` +
  `    const u = String(url || "");\n` +
  `    if (u.includes("defaults.acs")) {\n` +
  `      return Promise.resolve(new Response(defaultsText, { status: 200, headers: { "content-type": "text/css" } }));\n` +
  `    }\n` +
  `    return origFetch.apply(this, arguments);\n` +
  `  };\n` +
  `})();\n` +
  `</script>\n` +
  `<script type="module">\n` + runtime.replace(/<\/script>/gi, "<\\/script>") + `\n</script>\n`;

let out = html;
// Remove the original <link rel="audiostyle"> — the fetch shim handles it.
out = out.replace(/<link[^>]+rel=["']audiostyle["'][^>]*>\s*\n?/g, "");
// Replace the runtime script tag with our inlined block.
out = out.replace(
  /<script[^>]+src=["']runtime\.js["'][^>]*>\s*<\/script>/g,
  runtimeBlock
);

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(
  `[build-webview-picker] wrote ${OUT}\n` +
  `  picker source: ${(html.length / 1024).toFixed(1)} KB\n` +
  `  inlined runtime: ${(runtime.length / 1024).toFixed(1)} KB\n` +
  `  inlined defaults: ${(defaults.length / 1024).toFixed(1)} KB\n` +
  `  total output: ${(out.length / 1024).toFixed(1)} KB`
);

// Mirror to ALL installed copies of the extension (any version) so editor-
// side reloads pick up the fresh build without a separate `./install.sh`
// step. Webview HTML is loaded once at panel-creation, so the user still
// needs to close the picker tab + Reload Window to see the change — but
// the file content is already in place when they do.
const EXT_ROOTS = [
  join(homedir(), ".vscode/extensions"),
  join(homedir(), ".cursor/extensions"),
  join(homedir(), ".vscode-insiders/extensions"),
];
for (const root of EXT_ROOTS) {
  if (!existsSync(root)) continue;
  let entries;
  try { entries = readdirSync(root); } catch (e) { continue; }
  for (const entry of entries) {
    // Match both `acs-language-x.y.z` (folder-copy install) and
    // `acs.acs-language-x.y.z` (vsce-installed via --install-extension).
    if (!/^(acs\.)?acs-language-/.test(entry)) continue;
    const dest = join(root, entry, "webview", "picker.html");
    if (!existsSync(dirname(dest))) continue;
    try {
      copyFileSync(OUT, dest);
      console.log(`  → mirrored to ${dest}`);
    } catch (e) {
      console.warn(`  ! failed to mirror to ${dest}: ${e.message}`);
    }
  }
}
