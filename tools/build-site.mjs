// Assemble static site for Cloudflare Pages.
//
// Landing's index.html references absolute URLs (/dist/, /poc/). This script
// flattens the project into a single _site/ directory with that exact layout
// so Pages can serve it from the root without a rewrite layer.
//
// Also: HTML files in _site are post-processed for `<!-- include: path -->`
// directives, which inline the referenced fragment. Lets us split long
// pages (like /docs/index.html) into per-section fragments while keeping
// the deployed page a single self-contained HTML.
//
// CSS files in _site are passed through PostCSS — the only plugin is
// postcss-helmlab, which compiles helmlab()/helmlch()/helmgen()/helmgenlch()
// CSS functions into rgb() fallbacks plus color(display-p3 …) and
// color(rec2020 …) wide-gamut @supports overrides.
import { cp, mkdir, rm, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import helmlab from "postcss-helmlab";

const POSTCSS_PROCESSOR = postcss([helmlab({ outputMode: "all" })]);

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "_site");

async function copy(src, dest) {
  if (!existsSync(src)) return;
  await cp(src, dest, { recursive: true });
}

const INCLUDE_RE = /<!--\s*include:\s*([^\s-][^\s]*?)\s*-->/g;

/**
 * Recursively expand `<!-- include: path -->` directives inside an HTML
 * source. Paths resolve relative to the file containing the directive.
 * Stops at depth 4 to prevent runaway recursion if a fragment includes
 * itself (mistakenly).
 */
async function expandIncludes(filePath, depth = 0) {
  if (depth > 4) {
    console.error(`[build-site] include depth exceeded at ${filePath}`);
    return await readFile(filePath, "utf8");
  }
  const src = await readFile(filePath, "utf8");
  const dir = dirname(filePath);
  let out = "";
  let lastIndex = 0;
  for (const match of src.matchAll(INCLUDE_RE)) {
    out += src.slice(lastIndex, match.index);
    const includePath = resolve(dir, match[1]);
    try {
      const fragment = await expandIncludes(includePath, depth + 1);
      out += fragment.trimEnd() + "\n";
    } catch (err) {
      console.error(`[build-site] failed to inline ${includePath} from ${filePath}: ${err.message}`);
      out += match[0];   // leave the directive in place
    }
    lastIndex = match.index + match[0].length;
  }
  out += src.slice(lastIndex);
  return out;
}

async function processHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await processHtmlFiles(full);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      const expanded = await expandIncludes(full);
      await writeFile(full, expanded);
    }
  }
}

async function processCssFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await processCssFiles(full);
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      const raw = await readFile(full, "utf8");
      const result = await POSTCSS_PROCESSOR.process(raw, {
        from: full,
        to: full,
        map: false,
      });
      await writeFile(full, result.css);
      for (const warning of result.warnings()) {
        console.warn(`[postcss] ${full}: ${warning.toString()}`);
      }
    }
  }
}

async function removeFragmentDirs(dir) {
  // Drop any sections/ subdirectories from the deployed output — their
  // contents are already inlined into the parent index.html, no need to
  // ship the raw fragments.
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "sections") {
        await rm(full, { recursive: true, force: true });
      } else {
        await removeFragmentDirs(full);
      }
    }
  }
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

  // Expand `<!-- include: ... -->` directives in every HTML file under _site.
  await processHtmlFiles(OUT);
  // Drop the now-redundant sections/ fragment directories.
  await removeFragmentDirs(OUT);

  // Run every CSS file through postcss-helmlab so helmlch() functions are
  // compiled to rgb()/P3/Rec2020 before deployment. CSS authored in the
  // helm-lab perceptual space is non-renderable in browsers as-is.
  await processCssFiles(OUT);

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
