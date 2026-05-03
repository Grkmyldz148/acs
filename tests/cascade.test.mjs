#!/usr/bin/env node
/* cascade.test.mjs — selector compilation + matching tests.
 * Mocks the minimal DOM surface compileSelector touches.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

const { compileSelector } = await import(`${RUNTIME}/cascade.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) {
    fails++;
    console.error(`FAIL [${label}]`);
  } else {
    console.log(`OK   [${label}]`);
  }
}

function el(tag, opts = {}) {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    classList: {
      contains: (c) => (opts.classes || []).includes(c),
    },
    hasAttribute: (a) =>
      Object.prototype.hasOwnProperty.call(opts.attrs || {}, a),
    getAttribute: (a) => (opts.attrs || {})[a] ?? null,
    parentElement: null,
  };
  return node;
}

function tree(...nodes) {
  // chain parents: tree(parent, child, grand) → grand.parent = child, child.parent = parent
  for (let i = 1; i < nodes.length; i++) {
    nodes[i].parentElement = nodes[i - 1];
  }
  return nodes[nodes.length - 1];
}

const button = el("button", { classes: ["primary"] });
const inputRequired = el("input", { attrs: { required: "" } });
const dialog = el("dialog", { attrs: { open: "" } });
const buttonInDialog = tree(dialog, el("button", { classes: ["save"] }));

// --- tag selector ---
check("tag matches", compileSelector("button").matches(button));
check("tag mismatch", !compileSelector("a").matches(button));

// --- class selector ---
check("class matches",
  compileSelector(".primary").matches(button));
check("class mismatch",
  !compileSelector(".secondary").matches(button));

// --- compound tag.class ---
check("tag.class matches",
  compileSelector("button.primary").matches(button));
check("tag.class mismatch class",
  !compileSelector("button.danger").matches(button));
check("tag.class mismatch tag",
  !compileSelector("a.primary").matches(button));

// --- universal ---
check("* matches anything",
  compileSelector("*").matches(button));

// --- attribute presence ---
check("[required] matches",
  compileSelector("[required]").matches(inputRequired));
check("[required] doesn't match button",
  !compileSelector("[required]").matches(button));

// --- attribute equality ---
check("[type=submit] mismatch",
  !compileSelector("[type=submit]").matches(button));

const buttonSubmit = el("button", { attrs: { type: "submit" } });
check("[type=submit] matches",
  compileSelector("[type=submit]").matches(buttonSubmit));

// --- attribute compound ---
check("button[type=submit] matches",
  compileSelector("button[type=submit]").matches(buttonSubmit));

// --- descendant combinator ---
check("dialog[open] button matches button-in-dialog",
  compileSelector("dialog[open] button").matches(buttonInDialog));

const buttonOutside = el("button");
check("dialog[open] button rejects standalone button",
  !compileSelector("dialog[open] button").matches(buttonOutside));

// --- pseudo state ---
const c1 = compileSelector("button:on-click");
check("state event = click", c1.event === "click");
const c2 = compileSelector("input:on-input");
check("state event = input", c2.event === "input");
const c3 = compileSelector(".x:on-appear");
check("state event = appear", c3.event === "appear");

// --- specificity ordering ---
const sButton = compileSelector("button").specificity;
const sButtonClass = compileSelector("button.primary").specificity;
const sButtonClassAttr = compileSelector("button.primary[type=submit]").specificity;
const sDescendant = compileSelector("dialog[open] button").specificity;
const sClass = compileSelector(".toast").specificity;
const sAttr = compileSelector("[data-state=success]").specificity;
check("class > tag", sButtonClass > sButton);
check("attr adds specificity", sButtonClassAttr > sButtonClass);
check("descendant adds specificity", sDescendant > sButton);
check("class === attr (CSS conformant)", sClass === sAttr);

// --- :not(simple) ---
const cInputNotType = compileSelector("input:not([type])");
const plainInput = el("input");
const inputWithType = el("input", { attrs: { type: "text" } });
const buttonEl = el("button");
check(":not([type]) matches plain input", cInputNotType.matches(plainInput));
check(":not([type]) skips input[type=text]", !cInputNotType.matches(inputWithType));
check(":not([type]) skips non-input tag", !cInputNotType.matches(buttonEl));

const cBtnNotPrimary = compileSelector("button:not(.primary)");
const plainBtn = el("button");
const primaryBtn = el("button", { classes: ["primary"] });
check(":not(.primary) matches plain button", cBtnNotPrimary.matches(plainBtn));
check(":not(.primary) skips button.primary", !cBtnNotPrimary.matches(primaryBtn));

// --- attribute selector quoting ---
const cQuoted = compileSelector('input[type="text"]');
const inputText = el("input", { attrs: { type: "text" } });
check('input[type="text"] matches input[type=text]', cQuoted.matches(inputText));
const cSingleQuoted = compileSelector("input[type='text']");
check("input[type='text'] also matches", cSingleQuoted.matches(inputText));

// --- attribute value with whitespace must not split as descendant combinator ---
const cSpaceVal = compileSelector('[data-state="open closed"]');
const spaceValEl = el("div", { attrs: { "data-state": "open closed" } });
check('[data-state="a b"] matches space-containing value', cSpaceVal.matches(spaceValEl));
const otherEl = el("div", { attrs: { "data-state": "open" } });
check('[data-state="a b"] does NOT match other value', !cSpaceVal.matches(otherEl));

// --- child combinator graceful degradation ---
// Suppress the one-time warning for test cleanliness.
const origWarn = console.warn;
console.warn = () => {};
const cChild = compileSelector("dialog > button");
const dialogEl = el("dialog");
const btnInDialog = el("button", { });
btnInDialog.parentElement = dialogEl;
check("'A > B' degrades to descendant matching", cChild.matches(btnInDialog));
console.warn = origWarn;

// --- buildBindings + config-only rules (mood/pitch/volume etc) ---
const { buildBindings } = await import(`${RUNTIME}/cascade.js`);
const configOnlyRule = {
  selector: "body",
  decls: { "sound-mood": "glassy", pitch: "+1st" },
};
const eventRule = {
  selector: "button",
  decls: { "sound-on-click": "tap" },
};
const resolver = buildBindings([configOnlyRule, eventRule]);
const bodyEl = el("body");
const map = resolver(bodyEl);
check("config bucket exists in resolver map", Array.isArray(map.config));
check(
  "body's mood/pitch rule lands in config bucket",
  map.config.some((r) => r.decls["sound-mood"] === "glassy")
);

// --- !important ---
const { flatten } = await import(`${RUNTIME}/cascade.js`);
const { parse } = await import(`${RUNTIME}/parse.js`);

const impRules = parse(`
  .a { sound-on-click: low; }
  .a.b.c { sound-on-click: high; }
  .a { sound-on-click: forced !important; }
`);
const impResolver = (await import(`${RUNTIME}/cascade.js`)).buildBindings(impRules);
const impEl = el("div", { classes: ["a", "b", "c"] });
const impMap = impResolver(impEl);
const impFlat = flatten(impMap.click);
check("!important beats higher-specificity non-important",
  impFlat["sound-on-click"] === "forced");

const impRules2 = parse(`.x { sound: a !important; } .x { sound: b !important; }`);
const r2 = (await import(`${RUNTIME}/cascade.js`)).buildBindings(impRules2);
const e2 = el("div", { classes: ["x"] });
const flat2 = flatten(r2(e2).click);
check("among !important, source order wins (later)",
  flat2.sound === "b");

const noImp = parse(`button { sound: pop; volume: 0.5; }`);
check("no !important — decls unchanged", typeof noImp[0].decls.sound === "string");
check("no !important — __important absent", !noImp[0].decls.__important);

const yesImp = parse(`button { sound: pop !important; }`);
check("!important — value cleaned", yesImp[0].decls.sound === "pop");
check("!important — __important set", yesImp[0].decls.__important && yesImp[0].decls.__important.has("sound"));
check("!important — __important non-enumerable", !Object.keys(yesImp[0].decls).includes("__important"));

if (fails === 0) {
  console.log(`\n✓ All cascade tests passed.`);
} else {
  console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
}
process.exit(fails);
