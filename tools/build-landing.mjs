#!/usr/bin/env node
/* build-landing.mjs — pre-compile landing JSX into a single bundled JS
 * file, eliminating @babel/standalone (~3 MB) from the runtime path.
 *
 * The landing components use the legacy `window.X = function() { ... }`
 * registration pattern (no ES module imports between components). We
 * concatenate them in dependency order and run the whole thing through
 * esbuild with `--loader=jsx` to transform JSX → JS + minify.
 *
 * React + ReactDOM stay on CDN (UMD globals); we don't bundle them.
 *
 *   node tools/build-landing.mjs
 *
 * Output: dist/landing.bundle.js + .map
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const LANDING = join(ROOT, "landing");
const OUT_DIR = join(ROOT, "dist");

// Source order — registrations must happen before app.jsx consumes them.
// (window.X = function(){} pattern, not ES modules.)
const SOURCES = [
  "tweaks-panel.jsx",
  // hero.jsx must precede nav.jsx so its ACSShield component is on
  // window before Nav references it at render time.
  "components/hero.jsx",
  "components/nav.jsx",
  "components/features.jsx",
  "components/presets.jsx",
  "components/sections.jsx",
  "components/components-gallery.jsx",
  "components/before-after.jsx",
  "components/realworld.jsx",
  "app.jsx",
];

function concat() {
  const banner = `/* landing.bundle.js — pre-compiled JSX (esbuild). Source: ${SOURCES.length} files. */\n`;
  return banner + SOURCES.map((rel) => {
    const full = join(LANDING, rel);
    const text = readFileSync(full, "utf8");
    return `\n/* ── ${rel} ── */\n${text}\n`;
  }).join("");
}

const concatenated = concat();
mkdirSync(OUT_DIR, { recursive: true });

// Production build: inline sourcemap is ~3× the source size; emit
// alongside as .map instead so production payload stays minimal.
const result = await esbuild.transform(concatenated, {
  loader: "jsx",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  minify: true,
  target: ["es2020"],
  sourcemap: "external",
  sourcefile: "landing.bundle.jsx",
  logLevel: "info",
});

const outPath = join(OUT_DIR, "landing.bundle.js");
writeFileSync(outPath, result.code + "\n//# sourceMappingURL=landing.bundle.js.map\n");
writeFileSync(outPath + ".map", result.map);

const sizeKb = (Buffer.byteLength(result.code) / 1024).toFixed(1);
const inKb = (Buffer.byteLength(concatenated) / 1024).toFixed(1);
console.log(`[build-landing] wrote ${outPath} — ${sizeKb} KB (from ${inKb} KB JSX, ${SOURCES.length} files)`);
if (result.warnings.length) {
  console.warn(`[build-landing] ${result.warnings.length} warnings`);
  for (const w of result.warnings) console.warn(" ", w.text);
}
