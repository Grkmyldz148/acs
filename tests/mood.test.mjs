#!/usr/bin/env node
/* mood.test.mjs — verify applyMood wet/dry behavior.
 *
 * Mocks AudioContext so we can assert on the constructed node graph
 * without needing Web Audio in headless Node.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");
const { applyMood } = await import(`${RUNTIME}/mood.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// Minimal AudioContext mock — every node tracks its outgoing connections
// so we can walk the graph the runtime built.
function makeNode(label) {
  const node = {
    label,
    connections: [],
    connect(target) { this.connections.push(target); return target; },
    type: "",
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
    curve: null,
  };
  return node;
}
function makeCtx() {
  return {
    createGain() { return makeNode("gain"); },
    createBiquadFilter() { return makeNode("biquad"); },
    createWaveShaper() { return makeNode("waveshaper"); },
  };
}

// 1. Unknown mood / no mood / mix=0 → returns finalDest unchanged (bypass).
{
  const ctx = makeCtx();
  const dest = makeNode("dest");
  check("unknown mood returns dest", applyMood(ctx, "nonexistent", dest) === dest);
  check("empty mood returns dest", applyMood(ctx, "", dest) === dest);
  check("undefined mood returns dest", applyMood(ctx, undefined, dest) === dest);
  check("mix=0 returns dest", applyMood(ctx, "warm", dest, 0) === dest);
}

// 2. mix=1 (default) — single chain into dest, cached on second call.
{
  const ctx = makeCtx();
  const dest = makeNode("dest");
  const a = applyMood(ctx, "warm", dest);
  const b = applyMood(ctx, "warm", dest);
  check("mix=1 caches by (mood, dest)", a === b);

  // Cache should differ when dest differs.
  const dest2 = makeNode("dest2");
  const c = applyMood(ctx, "warm", dest2);
  check("different dest = different graph", a !== c);

  // Cache should differ when mood differs.
  const d = applyMood(ctx, "bright", dest);
  check("different mood = different graph", a !== d);
}

// 3. mix < 1 — builds a fresh dry/wet split graph each call (no cache).
{
  const ctx = makeCtx();
  const dest = makeNode("dest");
  const a = applyMood(ctx, "warm", dest, 0.5);
  const b = applyMood(ctx, "warm", dest, 0.5);
  check("mix<1 not cached (fresh graph each call)", a !== b);

  // The returned `entry` node should connect to TWO paths — dry and wet.
  // Dry path: entry → dryGain → dest. Wet path: entry → wetIn → ... → dest.
  // We can verify entry has 2+ connections (1 to dry, 1 to first wet node).
  check("mix<1 entry forks (≥2 outgoing)", a.connections.length >= 2);

  // The dry gain should be (1 - 0.5) = 0.5.
  const dry = a.connections.find((n) => n.label === "gain" && n.gain.value === 0.5);
  check("dry path gain = 1 - mix", !!dry);
}

// 4. mix > 1 clamped to 1 (no error).
{
  const ctx = makeCtx();
  const dest = makeNode("dest");
  const r = applyMood(ctx, "warm", dest, 2.5);
  check("mix>1 clamped (no throw)", r !== null && r !== undefined);
}

if (fails === 0) console.log("\n✓ All mood tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
