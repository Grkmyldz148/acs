#!/usr/bin/env node
/* var-bridge.test.mjs — verify CSS-var bridge resolves `var(--name)` in
 * ACS values against `:root`'s computed styles.
 *
 * Mocks document + getComputedStyle so we can drive resolution without
 * a real browser.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// Set up a fake document.documentElement with custom-property storage.
const props = new Map();
globalThis.document = {
  documentElement: {},
};
globalThis.getComputedStyle = () => ({
  getPropertyValue: (name) => props.get(name) ?? "",
});

const { resolveVar, parseFreq, parseTime, parsePitch, parseVolume, parseDb, parseList } =
  await import(`${RUNTIME}/parse.js`);

// 1. Plain values pass through untouched.
check("plain string passes through", resolveVar("440hz") === "440hz");
check("non-string returns as-is", resolveVar(42) === 42);
check("undefined returns as-is", resolveVar(undefined) === undefined);
check("string without var() passes through", resolveVar("0.5 !raw") === "0.5 !raw");

// 2. Resolved variable.
props.set("--ui-loud", "0.85");
check("var(--ui-loud) resolves", resolveVar("var(--ui-loud)") === "0.85");
check("var() with whitespace resolves", resolveVar("var(  --ui-loud  )") === "0.85");

// 3. Fallback when undefined.
check("var() with fallback uses fallback when undefined",
  resolveVar("var(--missing, 0.5)") === "0.5");
check("var() with fallback prefers defined value",
  resolveVar("var(--ui-loud, 0.99)") === "0.85");
check("var() with no fallback returns empty when undefined",
  resolveVar("var(--missing)") === "");

// 4. Nested in a unit-bearing value.
props.set("--my-freq", "880");
props.set("--my-decay", "150ms");
check("parseFreq resolves var() before unit parse",
  parseFreq("var(--my-freq)hz") === 880);
check("parseTime resolves var() with whole-value substitution",
  parseTime("var(--my-decay)") === 0.150);

// 5. Pitch in semitones via var().
props.set("--bump", "+5st");
check("parsePitch via var() (+5st)", Math.abs(parsePitch("var(--bump)") - Math.pow(2, 5/12)) < 1e-9);

// 6. Volume via var().
props.set("--vol", "0.7");
check("parseVolume via var()", parseVolume("var(--vol)") === 0.7);

// 7. Db via var().
props.set("--low-eq", "+2dB");
check("parseDb via var()", parseDb("var(--low-eq)") === 2);

// 8. List via var() — single token replaced.
props.set("--three-ratios", "1, 2.4, 3.6");
check("parseList via var() (3 items)",
  JSON.stringify(parseList("var(--three-ratios)")) === "[1,2.4,3.6]");

// 9. Multiple var() in one string.
props.set("--low", "100");
props.set("--high", "5000");
check("multiple var() in one value",
  resolveVar("var(--low) var(--high)") === "100 5000");

// 10. Recursive var fallback chain (only one level — we don't recurse).
props.set("--a", "var(--b, fallback)");
check("var fallback is text-substituted, not recursed",
  resolveVar("var(--a, x)") === "var(--b, fallback)");

// 11. Missing `document.documentElement` → return as-is.
{
  const saved = globalThis.document.documentElement;
  globalThis.document.documentElement = null;
  check("no documentElement → bypass", resolveVar("var(--ui-loud)") === "var(--ui-loud)");
  globalThis.document.documentElement = saved;
}

if (fails === 0) console.log("\n✓ All var-bridge tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
