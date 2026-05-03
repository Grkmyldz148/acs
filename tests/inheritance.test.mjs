#!/usr/bin/env node
/* inheritance.test.mjs — verify that body-level inheritable properties
 * (sound-mood, pitch, room, volume, pan, velocity-filter) actually
 * reach descendant trigger decls through cascade + applyInheritance.
 *
 * Regression guard for the 2026-05-03 bug where buildBindings filtered
 * config-only rules out of the resolver map, breaking inheritance for
 * theme-level body { sound-mood: ...; pitch: ... } declarations.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

const { buildBindings } = await import(`${RUNTIME}/cascade.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

function el(tag, opts = {}) {
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    classList: { contains: (c) => (opts.classes || []).includes(c) },
    hasAttribute: (a) => Object.prototype.hasOwnProperty.call(opts.attrs || {}, a),
    getAttribute: (a) => (opts.attrs || {})[a] ?? null,
    parentElement: opts.parent || null,
  };
}

const INHERITED_PROPS = [
  "sound-mood", "room", "room-mix", "volume", "pitch", "pan", "velocity-filter",
];

// Mimic the runtime's applyInheritance — must read from ALL buckets in
// the resolver map (including the `config` bucket), not just event ones.
function applyInheritance(start, decls, resolver) {
  const out = { ...decls };
  for (const prop of INHERITED_PROPS) {
    if (out[prop]) continue;
    let current = start.parentElement;
    while (current) {
      const map = resolver(current);
      let found = null;
      for (const evList of Object.values(map)) {
        for (const r of evList) {
          if (r.decls[prop]) { found = r.decls[prop]; break; }
        }
        if (found) break;
      }
      if (found) { out[prop] = found; break; }
      current = current.parentElement;
    }
  }
  return out;
}

// Scenario: body sets mood + pitch; button has its own click sound.
// Trigger button click — decls should include inherited mood + pitch.
const rules = [
  { selector: "body", decls: { "sound-mood": "glassy", pitch: "+1st" } },
  { selector: "button", decls: { "sound-on-click": "tap-tactile" } },
];
const resolver = buildBindings(rules);
const body = el("body");
const button = el("button", { parent: body });

const buttonMap = resolver(button);
check("button has click bucket", buttonMap.click.length === 1);
check(
  "button click decl is tap-tactile",
  buttonMap.click[0].decls["sound-on-click"] === "tap-tactile"
);

const inherited = applyInheritance(button, { "sound-on-click": "tap-tactile" }, resolver);
check("inherited mood = glassy", inherited["sound-mood"] === "glassy");
check("inherited pitch = +1st", inherited.pitch === "+1st");
check("own decl preserved", inherited["sound-on-click"] === "tap-tactile");

// Scenario: nested ancestor — body sets mood, intermediate div doesn't,
// deepest button needs to walk past the div to body.
const div = el("div", { parent: body });
const deepBtn = el("button", { parent: div });
const inherited2 = applyInheritance(deepBtn, { "sound-on-click": "x" }, resolver);
check("inheritance crosses non-matching ancestor", inherited2["sound-mood"] === "glassy");

// Scenario: closest ancestor wins. div has its own pitch; should beat body.
const rules2 = [
  { selector: "body", decls: { pitch: "+1st" } },
  { selector: "div.special", decls: { pitch: "-3st" } },
  { selector: "button", decls: { "sound-on-click": "tap" } },
];
const resolver2 = buildBindings(rules2);
const specialDiv = el("div", { classes: ["special"], parent: body });
const btn2 = el("button", { parent: specialDiv });
const inh2 = applyInheritance(btn2, {}, resolver2);
check("nearest-ancestor wins for pitch", inh2.pitch === "-3st");

// Scenario: own decl wins over inherited.
const rules3 = [
  { selector: "body", decls: { pitch: "+1st" } },
  { selector: "button", decls: { "sound-on-click": "x", pitch: "-3st" } },
];
const resolver3 = buildBindings(rules3);
const btn3 = el("button", { parent: body });
const ownDecls = { "sound-on-click": "x", pitch: "-3st" };
const inh3 = applyInheritance(btn3, ownDecls, resolver3);
check("own decl beats inherited", inh3.pitch === "-3st");

// Scenario: room and volume also inheritable.
const rules4 = [
  { selector: "body", decls: { room: "chamber", volume: "0.7" } },
  { selector: "button", decls: { "sound-on-click": "x" } },
];
const resolver4 = buildBindings(rules4);
const btn4 = el("button", { parent: body });
const inh4 = applyInheritance(btn4, {}, resolver4);
check("room inherits", inh4.room === "chamber");
check("volume inherits", inh4.volume === "0.7");

if (fails === 0) console.log("\n✓ All inheritance tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
