// Assemble static site for Cloudflare Pages.
//
// Landing's index.html references absolute URLs (/dist/, /poc/). This script
// flattens the project into a single _site/ directory with that exact layout
// so Pages can serve it from the root without a rewrite layer.
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "_site");

async function copy(src, dest) {
  if (!existsSync(src)) return;
  await cp(src, dest, { recursive: true });
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // landing/* → root (index.html, components/, *.css, acs-logo.svg, etc.)
  await copy(join(ROOT, "landing"), OUT);

  // /dist/landing.bundle.js needed by index.html
  await mkdir(join(OUT, "dist"), { recursive: true });
  await copy(join(ROOT, "dist", "landing.bundle.js"), join(OUT, "dist", "landing.bundle.js"));

  // /poc/runtime.js + /poc/defaults.acs + /poc/runtime/* (modules) + /poc/themes/*
  await mkdir(join(OUT, "poc"), { recursive: true });
  await copy(join(ROOT, "poc", "runtime.js"), join(OUT, "poc", "runtime.js"));
  await copy(join(ROOT, "poc", "defaults.acs"), join(OUT, "poc", "defaults.acs"));
  await copy(join(ROOT, "poc", "runtime"), join(OUT, "poc", "runtime"));
  await copy(join(ROOT, "poc", "themes"), join(OUT, "poc", "themes"));

  // _headers — wide-open CORS so the .acs files load fine cross-origin too
  await writeFile(join(OUT, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/poc/*
  Access-Control-Allow-Origin: *

/dist/*
  Access-Control-Allow-Origin: *
`);

  console.log(`[build-site] wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
