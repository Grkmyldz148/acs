#!/usr/bin/env node
/* voicepool.test.mjs — verify polyphony cap + voice stealing.
 * Mocks AudioContext to enable headless testing of acquire/steal/prune.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");
const vp = await import(`${RUNTIME}/voicepool.js`);

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// Minimal AudioContext mock — only needs createGain + currentTime.
function makeCtx(t = 0) {
  return {
    currentTime: t,
    createGain() {
      return {
        gain: {
          value: 1,
          cancelScheduledValues: () => {},
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
      };
    },
  };
}

// 1. Default cap (8 voices). 9th acquire steals oldest.
{
  const ctx = makeCtx(1.0);
  const voices = [];
  for (let i = 0; i < 8; i++) {
    voices.push(vp.acquire(ctx, "vp-1", 1.0));
  }
  check("8 voices acquired, no steal yet", voices.length === 8);
  // 9th should trigger steal of oldest
  ctx.currentTime = 1.05;
  const v9 = vp.acquire(ctx, "vp-1", 1.0);
  check("9th voice acquired (oldest stolen)", !!v9);
  // First voice's endTime should have been updated by steal
  check("oldest voice endTime moved up by steal", voices[0].endTime <= 1.05 + 0.02);
}

// 2. Different presets are independent (each has own pool).
{
  const ctx = makeCtx(2.0);
  for (let i = 0; i < 8; i++) vp.acquire(ctx, "vp-2a", 1.0);
  // 8 of 'a' fills its pool. 'b' should still get fresh voices.
  const stats = vp._stats();
  check("vp-2a pool has 8 voices", stats["vp-2a"] === 8);
  for (let i = 0; i < 5; i++) vp.acquire(ctx, "vp-2b", 1.0);
  const stats2 = vp._stats();
  check("vp-2b pool has 5 voices, independent", stats2["vp-2b"] === 5);
}

// 3. Pruning — voices past their endTime get freed.
{
  const ctx = makeCtx(3.0);
  for (let i = 0; i < 8; i++) vp.acquire(ctx, "vp-3", 0.1);
  // All voices end at 3.1. Advance ctx beyond.
  ctx.currentTime = 3.2;
  // Acquire one more — pruneFinished should clear all 8 first, no steal needed.
  vp.acquire(ctx, "vp-3", 1.0);
  const stats = vp._stats();
  check("expired voices pruned before acquire", stats["vp-3"] === 1);
}

// 4. Custom cap via setCap.
{
  vp.setCap("vp-4", 3);
  const ctx = makeCtx(4.0);
  for (let i = 0; i < 3; i++) vp.acquire(ctx, "vp-4", 1.0);
  vp.acquire(ctx, "vp-4", 1.0);  // 4th — steals
  const stats = vp._stats();
  check("custom cap=3 enforced", stats["vp-4"] === 3);
}

if (fails === 0) console.log("\n✓ All voicepool tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
