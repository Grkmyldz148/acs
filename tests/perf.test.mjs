/* perf.test.mjs — micro-benchmarks for the runtime hot path.
 *
 * Reports timings, doesn't assert pass/fail (audio runtime is real-time;
 * any sub-millisecond ops are fine for UI sound use). Use this to spot
 * regressions when changing parse/cascade/compile internals.
 *
 *   node tests/perf.test.mjs
 */

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parse } from "../poc/runtime/parse.js";
import { compileSelector, buildBindings } from "../poc/runtime/cascade.js";

function bench(name, fn, iterations = 1000) {
  // warmup
  for (let i = 0; i < Math.min(50, iterations); i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - t0;
  const perOp = (elapsed / iterations) * 1000; // µs
  console.log(`  ${name.padEnd(40)} ${(elapsed).toFixed(2).padStart(8)}ms total · ${perOp.toFixed(2).padStart(7)} µs/op`);
  return perOp;
}

console.log("\n— parse —");
const defaultsText = readFileSync("poc/defaults.acs", "utf8");
const themesText = ["apple", "material", "retro", "brutalist"]
  .map((t) => readFileSync(`poc/themes/${t}.acs`, "utf8"))
  .join("\n");
bench("parse(defaults.acs)", () => parse(defaultsText), 200);
bench("parse(theme.acs x4)", () => parse(themesText), 500);

console.log("\n— compile —");
const selectors = [
  "button",
  "button.primary",
  "button[type=submit]",
  "[role=alert]",
  "[data-state=success]",
  "dialog[open] button",
  "input:not([type])",
  "summary",
  "input, textarea, select",
];
for (const sel of selectors) {
  bench(`compileSelector("${sel}")`, () => compileSelector(sel), 5000);
}

console.log("\n— cascade resolve —");
const allRules = parse(defaultsText + "\n" + themesText);
const resolver = buildBindings(
  allRules.filter((r) => !r.selector.startsWith("@") && r.selector !== ":root")
);

// Mock element shaped like real DOM for matcher
function mockEl(tag, opts = {}) {
  const classList = new Set(opts.classes || []);
  const attrs = opts.attrs || {};
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    classList: { contains: (c) => classList.has(c) },
    hasAttribute: (a) => Object.prototype.hasOwnProperty.call(attrs, a),
    getAttribute: (a) => attrs[a] ?? null,
    parentElement: null,
  };
}

const buttonEl = mockEl("button");
const primaryEl = mockEl("button", { classes: ["primary"] });
const inputEl = mockEl("input", { attrs: { type: "text" } });
const toastEl = mockEl("div", {
  classes: ["toast"],
  attrs: { "data-state": "success" },
});

bench("resolve(plain button)", () => resolver(buttonEl), 5000);
bench("resolve(button.primary)", () => resolver(primaryEl), 5000);
bench("resolve(input[type=text])", () => resolver(inputEl), 5000);
bench("resolve(.toast[data-state=success])", () => resolver(toastEl), 5000);

console.log("\nDone. Targets: <100µs/op for compile, <200µs/op for cascade resolve.\n");
