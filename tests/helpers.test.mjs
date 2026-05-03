#!/usr/bin/env node
/* helpers.test.mjs — verify play/attach/useSound adapters.
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

// Mock window.ACS with a recording trigger.
const triggerCalls = [];
globalThis.window = {
  ACS: { trigger: (decls, key) => { triggerCalls.push({ decls, key }); } },
};

const { play, attach, useSound } = await import(`${RUNTIME}/helpers.js`);

// 1. play(name) sends `sound: name` and event=click.
{
  triggerCalls.length = 0;
  play("ding");
  check("play(name) → trigger called",
    triggerCalls.length === 1 &&
    triggerCalls[0].decls.sound === "ding" &&
    triggerCalls[0].key === "click");
}

// 2. play(name, opts) merges decls.
{
  triggerCalls.length = 0;
  play("pop", { volume: 0.7, room: "small-room" });
  check("play(name, opts) merges decls",
    triggerCalls[0].decls.sound === "pop" &&
    triggerCalls[0].decls.volume === "0.7" &&
    triggerCalls[0].decls.room === "small-room");
}

// 3. play() with no name no-ops.
{
  triggerCalls.length = 0;
  play("");
  check("play(empty) no-op", triggerCalls.length === 0);
}

// 4. play() when ACS not ready no-ops (no throw).
{
  const saved = window.ACS;
  window.ACS = undefined;
  try { play("ding"); check("play without ACS no-op (no throw)", true); }
  catch (e) { check("play without ACS no-op (no throw)", false); }
  window.ACS = saved;
}

// 5. attach(el, name) returns unbind, fires play on event.
{
  triggerCalls.length = 0;
  let listener = null;
  const fakeEl = {
    addEventListener: (ev, fn) => { listener = { ev, fn }; },
    removeEventListener: (ev, fn) => { if (listener && listener.fn === fn) listener = null; },
  };
  const off = attach(fakeEl, "tick");
  check("attach default event = click", listener && listener.ev === "click");
  listener.fn();
  check("attach handler triggers play",
    triggerCalls.length === 1 && triggerCalls[0].decls.sound === "tick");
  off();
  check("attach unbind works", listener === null);
}

// 6. attach with custom event.
{
  let listener = null;
  const fakeEl = {
    addEventListener: (ev, fn) => { listener = { ev, fn }; },
    removeEventListener: () => {},
  };
  attach(fakeEl, "tick", "input");
  check("attach custom event = input", listener && listener.ev === "input");
}

// 7. attach to null/undefined is a safe no-op (returns no-op fn).
{
  const off = attach(null, "ding");
  check("attach(null) returns fn (no-op)", typeof off === "function");
  off(); // shouldn't throw
}

// 8. useSound returns a callback memoized by useCallback.
{
  let cbDeps = null;
  let cbFn = null;
  const fakeHooks = {
    useCallback: (fn, deps) => { cbDeps = deps; cbFn = fn; return fn; },
  };
  const handler = useSound(fakeHooks, "ding", { volume: 0.6 });
  check("useSound returns the memoized callback", typeof handler === "function");
  check("useSound deps include name", cbDeps && cbDeps[0] === "ding");
  check("useSound deps include opts JSON",
    cbDeps && cbDeps[1] === JSON.stringify({ volume: 0.6 }));

  triggerCalls.length = 0;
  handler();
  check("useSound callback triggers play",
    triggerCalls.length === 1 && triggerCalls[0].decls.sound === "ding" &&
    triggerCalls[0].decls.volume === "0.6");
}

// 9. useSound throws when hooks lib missing useCallback.
{
  let threw = false;
  try { useSound({}, "ding"); } catch (e) { threw = true; }
  check("useSound throws on bad hooks arg", threw);
}

if (fails === 0) console.log("\n✓ All helpers tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
