#!/usr/bin/env node
/* parse.test.mjs — regression tests for the ACS parser.
 *
 * Run:  node tests/parse.test.mjs
 *
 * Exit code = number of failures.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

const { parse, parseLayer, parseList, parseFreq, parseTime, parsePitch } =
  await import(`${RUNTIME}/parse.js`);

let fails = 0;
function eq(label, got, expected) {
  const gotJson = JSON.stringify(got);
  const expJson = JSON.stringify(expected);
  if (gotJson !== expJson) {
    fails++;
    console.error(`FAIL [${label}]:\n  expected: ${expJson}\n  got:      ${gotJson}`);
  } else {
    console.log(`OK   [${label}]`);
  }
}

// --- parse() tests ---

eq("empty input", parse(""), []);

eq("single rule",
   parse("button { sound: tap; }"),
   [{ selector: "button", decls: { sound: "tap" } }]);

eq("multiple selectors",
   parse("button, a { sound: tap; }"),
   [
     { selector: "button", decls: { sound: "tap" } },
     { selector: "a", decls: { sound: "tap" } },
   ]);

eq("multiple decls",
   parse("button { sound: tap; volume: 0.5; pitch: 2st; }"),
   [{ selector: "button", decls: { sound: "tap", volume: "0.5", pitch: "2st" } }]);

eq("comments stripped",
   parse("/* hi */ button /* mid */ { sound: tap; /* tail */ }"),
   [{ selector: "button", decls: { sound: "tap" } }]);

eq("nested @media",
   parse("@media (max-width: 768px) { button { sound: click; } }"),
   [{ selector: "button", decls: { sound: "click" }, mediaCondition: "(max-width: 768px)" }]);

eq("@sound block",
   parse("@sound foo { body: noise: white, decay: 50ms; }"),
   [{ selector: "@sound foo", decls: { body: "noise: white, decay: 50ms" } }]);

eq("colon inside synth value preserved",
   parse("button { sound: synth(osc: sine, freq: 440hz); }").map(r => r.decls),
   [{ sound: "synth(osc: sine, freq: 440hz)" }]);

// --- parseLayer ---

eq("parseLayer simple",
   parseLayer("noise: white, decay: 50ms, gain: 0.5"),
   { noise: "white", decay: "50ms", gain: "0.5" });

// --- parseList ---

eq("parseList plus", parseList("1+1.5+2.5+4"), [1, 1.5, 2.5, 4]);
eq("parseList space", parseList("1 1.5 2.5 4"), [1, 1.5, 2.5, 4]);
eq("parseList mixed", parseList("1 + 1.5  + 2.5"), [1, 1.5, 2.5]);
eq("parseList empty", parseList(""), []);

// --- parseFreq ---

eq("parseFreq hz", parseFreq("440hz"), 440);
eq("parseFreq khz", parseFreq("2.5khz"), 2500);
eq("parseFreq raw num", parseFreq("440"), 440);
eq("parseFreq fallback", parseFreq("", 220), 220);

// --- parseTime ---

eq("parseTime ms", parseTime("50ms"), 0.05);
eq("parseTime s", parseTime("0.5s"), 0.5);

// --- parsePitch ---

eq("parsePitch positive", parsePitch("2st"), Math.pow(2, 2 / 12));
eq("parsePitch negative", parsePitch("-12st"), 0.5);
eq("parsePitch raw mul", parsePitch("1.5"), 1.5);
eq("parsePitch +12st (with sign)", parsePitch("+12st"), 2);
eq("parsePitch +1st (Apple theme case)", parsePitch("+1st"), Math.pow(2, 1 / 12));
eq("parsePitch +0.5st", parsePitch("+0.5st"), Math.pow(2, 0.5 / 12));

// --- parseFreq ---
eq("parseFreq plain", parseFreq("440hz"), 440);
eq("parseFreq khz", parseFreq("1.5khz"), 1500);
eq("parseFreq with sign", parseFreq("+880hz"), 880);
eq("parseFreq fallback on garbage", parseFreq("xyz", 99), 99);

// --- parseTime ---
eq("parseTime ms", parseTime("100ms"), 0.1);
eq("parseTime s", parseTime("0.5s"), 0.5);
eq("parseTime fallback on empty", parseTime("", 0.2), 0.2);
eq("parseTime negative clamped to 0", parseTime("-50", 0.2), 0);

// --- selector / @media combinations ---

const big = parse(`
:root { master-volume: 0.8; }
button { sound-on-click: tap; }
@media (prefers-reduced-sound: reduce) {
  :root { master-volume: 0; }
  .alert { sound: tick; }
}
@sound mybell {
  ring: modal: 660hz, ratios: 1 2, decays: 0.5 0.25;
}
`);
eq("big example: rule count", big.length, 5);
eq("big example: media-conditioned count",
   big.filter(r => r.mediaCondition).length, 2);
eq("big example: @sound count",
   big.filter(r => r.selector.startsWith("@sound")).length, 1);

// @sound override inside @media — must inherit mediaCondition.
const mediaSound = parse(`
@media (prefers-reduced-sound: reduce) {
  @sound bell {
    ring { osc: sine; freq: 100hz; gain: 0.01; }
  }
}`);
eq("@sound inside @media count", mediaSound.length, 1);
eq("@sound inside @media has mediaCondition",
   mediaSound[0].mediaCondition, "(prefers-reduced-sound: reduce)");
eq("@sound inside @media keeps selector",
   mediaSound[0].selector, "@sound bell");

// Multi-selector with comma — each selector becomes its own rule.
const multi = parse(`button, a, input { sound-on-click: tap; }`);
eq("multi-selector splits to N rules", multi.length, 3);

// Nested CSS-vari layer block parsing with mid-block comment.
const nested = parse(`@sound x {
  body {
    osc: sine;
    freq: 440hz;
    /* mid-block comment */
    decay: 100ms;
  }
}`);
eq("nested layer parses to nested object",
   typeof nested[0].decls.body, "object");
eq("nested layer keys preserved (sorted)",
   Object.keys(nested[0].decls.body).sort(),
   ["decay", "freq", "osc"]);

if (fails === 0) {
  console.log(`\n✓ All tests passed.`);
} else {
  console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
}
process.exit(fails);
