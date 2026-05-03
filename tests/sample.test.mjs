#!/usr/bin/env node
/* sample.test.mjs — verify @sample <name> url("...") parsing.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");
const { parse } = await import(`${RUNTIME}/parse.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// 1. Basic @sample with double-quoted url.
{
  const rules = parse(`@sample my-thump url("sounds/thump.wav");`);
  const r = rules.find((x) => x.selector === "@sample my-thump");
  check("registers @sample with double-quoted url", r && r.decls.url === "sounds/thump.wav");
}

// 2. Single-quoted url.
{
  const rules = parse(`@sample tap url('sounds/tap.mp3');`);
  const r = rules.find((x) => x.selector === "@sample tap");
  check("single-quoted url", r && r.decls.url === "sounds/tap.mp3");
}

// 3. No-quote url.
{
  const rules = parse(`@sample drip url(./drip.ogg);`);
  const r = rules.find((x) => x.selector === "@sample drip");
  check("no-quote url", r && r.decls.url === "./drip.ogg");
}

// 4. Multiple @samples + a regular rule coexist without parser confusion.
{
  const rules = parse(`
    @sample thump url("a.wav");
    @sample crack url("b.wav");
    button { sound-on-click: thump; }
  `);
  const samples = rules.filter((r) => r.selector.startsWith("@sample"));
  const button = rules.find((r) => r.selector === "button");
  check("two samples both registered", samples.length === 2);
  check("regular rule still parsed", button && button.decls["sound-on-click"] === "thump");
}

// 5. Hyphenated name.
{
  const rules = parse(`@sample my-multi-word-sample url("x.wav");`);
  const r = rules.find((x) => x.selector === "@sample my-multi-word-sample");
  check("hyphenated name", r && r.decls.url === "x.wav");
}

// 6. Whitespace tolerance.
{
  const rules = parse(`@sample    foo    url(  "spaced.wav"  ) ;`);
  const r = rules.find((x) => x.selector === "@sample foo");
  check("whitespace tolerated", r && r.decls.url === "spaced.wav");
}

// 7. Comment-stripped before parsing.
{
  const rules = parse(`/* @sample bogus url("never.wav"); */ @sample real url("yes.wav");`);
  const samples = rules.filter((r) => r.selector.startsWith("@sample"));
  check("commented-out @sample ignored", samples.length === 1 && samples[0].selector === "@sample real");
}

if (fails === 0) console.log("\n✓ All sample tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
