#!/usr/bin/env node
/* split-docs.mjs — ONE-SHOT script.
 *
 * Splits landing/docs/index.html's monolithic <article> into per-section
 * fragments under landing/docs/sections/, then rewrites index.html's
 * article body to a list of `<!-- include: sections/X.html -->` directives.
 *
 * The build-site.mjs include processor expands the directives at deploy
 * time, so the deployed page is byte-identical to the original — but the
 * source becomes 28 small editable files instead of one 870-line wall.
 *
 * Run once. Re-running on already-split files is a no-op (the
 * `<article>` body will be all `<!-- include -->` lines and no
 * sentinel comments to extract).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const DOCS = join(ROOT, "landing/docs");
const INDEX = join(DOCS, "index.html");
const SECTIONS = join(DOCS, "sections");

const html = readFileSync(INDEX, "utf8");

const articleStart = html.indexOf('<article class="docs-article">');
const articleEnd = html.indexOf("</article>", articleStart);
if (articleStart < 0 || articleEnd < 0) {
  console.error("could not locate <article> bounds in index.html");
  process.exit(1);
}

const before = html.slice(0, articleStart) + '<article class="docs-article">';
const articleBody = html.slice(articleStart + '<article class="docs-article">'.length, articleEnd).trim();
const after = html.slice(articleEnd);

const sentinel = /<!--\s*════+\s*([A-Z@&\s+-]+)\s*════+\s*-->/g;
const matches = [...articleBody.matchAll(sentinel)];

if (matches.length === 0) {
  console.log("[split-docs] no sentinels found — already split?");
  process.exit(0);
}

if (!existsSync(SECTIONS)) mkdirSync(SECTIONS, { recursive: true });

const includes = [];
for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  const name = m[1].trim().toLowerCase()
    .replace(/[@&]/g, "")
    .replace(/[+\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const sectionStart = m.index + m[0].length;
  const sectionEnd = i + 1 < matches.length ? matches[i + 1].index : articleBody.length;
  const slice = articleBody.slice(sectionStart, sectionEnd).trimEnd();

  const fragmentPath = join(SECTIONS, `${name}.html`);
  writeFileSync(fragmentPath, slice + "\n");
  includes.push(`    <!-- include: sections/${name}.html -->`);
  console.log(`  → sections/${name}.html`);
}

const out =
  before + "\n\n" +
  includes.join("\n\n") + "\n\n  " +
  after;

writeFileSync(INDEX, out);
console.log(`\n[split-docs] split ${matches.length} sections; rewrote index.html to ${includes.length} includes.`);
