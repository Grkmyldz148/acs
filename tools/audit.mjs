#!/usr/bin/env node
/* audit.mjs — one-shot audit: tests + lint + perf + cross-checks.
 * Run before committing major runtime / preset changes.
 *
 *   node tools/audit.mjs
 *
 * Exits non-zero if any check fails. Warnings (perf delta, lint warnings
 * on user .acs files, calibration spread) print but don't fail.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "../poc/runtime/parse.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const log = (s) => console.log(s);
const ok = (s) => console.log("\x1b[32m✓\x1b[0m", s);
const fail = (s) => { fails++; console.error("\x1b[31m✗\x1b[0m", s); };
const section = (s) => console.log(`\n\x1b[1m── ${s} ──\x1b[0m`);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}

// 1. Tests
section("tests");
const t = run(process.execPath, ["tests/run-all.mjs"]);
if (t.code === 0) ok("all test files passed");
else fail(`tests failed (${t.code})\n${t.out}${t.err}`);

// 2. Lint defaults + themes
section("lint");
const lintTargets = [
  "poc/defaults.acs",
  "poc/themes/apple.acs",
  "poc/themes/material.acs",
  "poc/themes/retro.acs",
  "poc/themes/brutalist.acs",
  "poc/themes/cinematic.acs",
  "poc/themes/bauhaus.acs",
  "poc/themes/terminal.acs",
  "poc/themes/ambient.acs",
];
const lintRes = run(process.execPath, ["tools/lint-acs.mjs", ...lintTargets]);
if (lintRes.out.includes("No warnings")) ok("no lint warnings");
else if (lintRes.code === 0) {
  const warnLines = lintRes.out.split("\n").filter((l) => l.includes("warning")).length;
  console.log(`  ${warnLines} warning(s):\n${lintRes.out}`);
}
else fail(`lint failed:\n${lintRes.out}`);

// 3. Cross-check BAKED_FACTORS vs defaults.acs presets
section("cross-check baked factors");
const defaultsText = readFileSync(`${ROOT}/poc/defaults.acs`, "utf8");
const presets = new Set(
  parse(defaultsText)
    .filter((r) => r.selector.startsWith("@sound "))
    .map((r) => r.selector.slice(7).trim())
);
const calibText = readFileSync(`${ROOT}/poc/runtime/calibrate.js`, "utf8");
const block = calibText.match(/const BAKED_FACTORS = \{([\s\S]+?)\n\};/)[1];
const baked = new Set(
  [...block.matchAll(/^\s*['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*[\d.]+/gm)].map((m) => m[1])
);
const PROCEDURAL_ONLY = new Set(["keystroke", "old-bell"]);
const missing = [...presets].filter((p) => !baked.has(p));
const extra = [...baked].filter((b) => !presets.has(b) && !PROCEDURAL_ONLY.has(b));
if (missing.length === 0 && extra.length === 0) {
  ok(`${presets.size} DSL presets all have baked factors (+${PROCEDURAL_ONLY.size} procedural-only)`);
} else {
  if (missing.length) fail(`presets missing baked factor: ${missing.join(", ")}`);
  if (extra.length)   fail(`baked factors with no preset: ${extra.join(", ")}`);
}

// 4a. Cross-check that user .acs files reference only existing presets.
section("verify preset references");
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}
function extractRefs(text) {
  const refs = new Set();
  const stripped = stripComments(text);
  // sound: <name>;  sound-on-*: <name>;  but skip synth(...) and url(...) and 'none'/'silent'.
  const re = /sound(?:-on-(?:click|appear|input|focus|enter|leave))?\s*:\s*([a-z][a-z0-9-]*)\s*[;}]/g;
  let m;
  while ((m = re.exec(stripped))) {
    const v = m[1];
    if (v !== "none" && v !== "silent") refs.add(v);
  }
  return refs;
}
function extractCustoms(text) {
  const stripped = stripComments(text);
  // @sound names + @sample names both register a triggerable preset.
  const customs = new Set(parse(stripped)
    .filter((r) => r.selector.startsWith("@sound "))
    .map((r) => r.selector.slice(7).trim()));
  for (const m of stripped.matchAll(/@sample\s+([a-zA-Z_][\w-]*)\s+url\(/g)) {
    customs.add(m[1]);
  }
  return customs;
}
const knownPresets = new Set([...presets, ...PROCEDURAL_ONLY]);
const userFiles = [
  "poc/showcase.acs",
  "poc/themes/apple.acs",
  "poc/themes/material.acs",
  "poc/themes/retro.acs",
  "poc/themes/brutalist.acs",
  "poc/themes/cinematic.acs",
  "poc/themes/bauhaus.acs",
  "poc/themes/terminal.acs",
  "poc/themes/ambient.acs",
];
for (const f of userFiles) {
  const t = readFileSync(`${ROOT}/${f}`, "utf8");
  const refs = extractRefs(t);
  const customs = extractCustoms(t);
  let badInFile = 0;
  for (const ref of refs) {
    if (!knownPresets.has(ref) && !customs.has(ref)) {
      fail(`${f}: references unknown preset "${ref}"`);
      badInFile++;
    }
  }
  if (badInFile === 0) ok(`${f}: ${refs.size} preset refs resolve`);
}

// 4b. Cross-check landing engine (legacy mock kept in poc/landing-engine.js
// for compare.html A/B testing — landing/index.html uses the real ACS
// runtime; the standalone mock was removed).
section("cross-check landing parity");
const landingText = readFileSync(`${ROOT}/poc/landing-engine.js`, "utf8");
const presetBlockMatch = landingText.match(/const presets = \{([\s\S]+?)\n\s*\};/);
if (presetBlockMatch) {
  const presetBlock = presetBlockMatch[1];
  const landingPresets = new Set(
    [...presetBlock.matchAll(/^\s*['"]?([a-z][a-z-]*)['"]?\s*:/gm)].map((m) => m[1])
  );
  const acsAll = new Set([...presets, ...PROCEDURAL_ONLY]);
  const missingFromACS = [...landingPresets].filter((p) => !acsAll.has(p));
  if (missingFromACS.length === 0) ok(`all ${landingPresets.size} landing presets have ACS equivalents`);
  else fail(`landing presets missing in ACS: ${missingFromACS.join(", ")}`);
}

// 5. Calibration spread
section("calibration spread");
const cal = run(process.execPath, ["analyzer/defaults-loudness.mjs"]);
const spreadMatch = cal.out.match(/post-cal spread:\s+([\d.]+)x\s+\(([\d.]+) dB\)/);
if (spreadMatch) {
  const spread = parseFloat(spreadMatch[2]);
  if (spread <= 6.0) ok(`spread ${spread} dB (target ≤ 6 dB)`);
  else if (spread <= 10.0) console.log(`  spread ${spread} dB (target ≤ 6, acceptable ≤ 10)`);
  else fail(`spread ${spread} dB exceeds 10 dB threshold`);
}

// 6. Perf — only hot-path ops (compile + cascade resolve), not parse
section("perf");
const perf = run(process.execPath, ["tests/perf.test.mjs"]);
const hotPath = perf.out
  .split("\n")
  .filter((l) => /(resolve|compileSelector)\(/.test(l))
  .map((l) => parseFloat(l.match(/(\d+(\.\d+)?)\s*µs\/op/)?.[1] ?? "0"));
if (hotPath.length) {
  const max = Math.max(...hotPath);
  if (max < 100) ok(`max hot-path op cost ${max.toFixed(1)} µs (target < 100)`);
  else fail(`hot-path op cost ${max.toFixed(1)} µs exceeds 100 µs target`);
}

console.log("");
if (fails === 0) {
  console.log("\x1b[32mAUDIT PASSED\x1b[0m");
  process.exit(0);
} else {
  console.error(`\x1b[31mAUDIT FAILED (${fails})\x1b[0m`);
  process.exit(fails);
}
