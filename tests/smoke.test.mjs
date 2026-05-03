#!/usr/bin/env node
/* smoke.test.mjs — verify all runtime modules load without error.
 * Catches regressions where an import fails, an export is missing,
 * or a top-level statement crashes (e.g., trying to access window).
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

let fails = 0;
function check(label, condition, err) {
  if (!condition) {
    fails++;
    console.error(`FAIL [${label}]${err ? `: ${err}` : ""}`);
  } else console.log(`OK   [${label}]`);
}

const modules = [
  "parse.js",
  "audio.js",
  "calibrate.js",
  "cascade.js",
  "dom.js",
  "dsp.js",
  "media.js",
  "mood.js",
  "presets.js",
  "throttle.js",
  "validate.js",
  "voicepool.js",
];

for (const m of modules) {
  try {
    await import(`${RUNTIME}/${m}`);
    check(`load ${m}`, true);
  } catch (e) {
    check(`load ${m}`, false, e.message);
  }
}

// Verify key exports per module.
const parse = await import(`${RUNTIME}/parse.js`);
check("parse exports parse()", typeof parse.parse === "function");
check("parse exports parsePitch()", typeof parse.parsePitch === "function");
check("parse exports parseTime()", typeof parse.parseTime === "function");
check("parse exports parseFreq()", typeof parse.parseFreq === "function");
check("parse exports parseSequence()", typeof parse.parseSequence === "function");
check("parse exports parseLayer()", typeof parse.parseLayer === "function");

const cascade = await import(`${RUNTIME}/cascade.js`);
check("cascade exports compileSelector()", typeof cascade.compileSelector === "function");
check("cascade exports buildBindings()", typeof cascade.buildBindings === "function");
check("cascade exports flatten()", typeof cascade.flatten === "function");

const validate = await import(`${RUNTIME}/validate.js`);
check("validate exports validateLayer()", typeof validate.validateLayer === "function");
check("validate exports validateRuleDecls()", typeof validate.validateRuleDecls === "function");
check("validate exports validateUnknownSound()", typeof validate.validateUnknownSound === "function");

const throttle = await import(`${RUNTIME}/throttle.js`);
check("throttle exports shouldThrottle()", typeof throttle.shouldThrottle === "function");

const vp = await import(`${RUNTIME}/voicepool.js`);
check("voicepool exports acquire()", typeof vp.acquire === "function");
check("voicepool exports setCap()", typeof vp.setCap === "function");

const mood = await import(`${RUNTIME}/mood.js`);
check("mood exports applyMood()", typeof mood.applyMood === "function");
check("mood exports moodNames", Array.isArray(mood.moodNames));

const media = await import(`${RUNTIME}/media.js`);
check("media exports matchMediaQuery()", typeof media.matchMediaQuery === "function");
check("media exports installModalityTracker()", typeof media.installModalityTracker === "function");
check("media exports onModalityChange()", typeof media.onModalityChange === "function");

const presets = await import(`${RUNTIME}/presets.js`);
check("presets exports presets object", typeof presets.presets === "object");
// Procedural presets that should exist:
const requiredProcedural = ["keystroke"];
for (const p of requiredProcedural) {
  check(`presets.${p} exists`, typeof presets.presets[p] === "function");
}

// Verify mood cache works (calling applyMood with same args returns same node).
const { applyMood } = await import(`${RUNTIME}/mood.js`);
let createGainCalls = 0;
const fakeCtx = {
  createGain() { createGainCalls++; return { connect: () => {} }; },
  createBiquadFilter() { return { type: "", frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 }, connect: () => {} }; },
  createWaveShaper() { return { curve: null, connect: () => {} }; },
};
const dest = { connect: () => {} };
const a1 = applyMood(fakeCtx, "warm", dest);
const beforeCount = createGainCalls;
const a2 = applyMood(fakeCtx, "warm", dest);
check("mood cache returns same input gain", a1 === a2);
check("mood cache skips re-creating nodes", createGainCalls === beforeCount);

if (fails === 0) console.log("\n✓ All smoke tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
