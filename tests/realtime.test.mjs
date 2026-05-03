#!/usr/bin/env node
/* realtime.test.mjs — verify the `realtime: true` opt-in falls back to
 * main-thread when the worklet isn't ready, and routes to worklet when
 * it is.
 *
 * The worklet is unavailable in Node — we mock isWorkletReady() and
 * workletVoice() via module replacement at load time.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME = resolve(__dirname, "../poc/runtime");

let fails = 0;
function check(label, condition) {
  if (!condition) { fails++; console.error(`FAIL [${label}]`); }
  else console.log(`OK   [${label}]`);
}

// Build a temp copy of dsp.js that imports a stub audio.js so we can
// observe worklet calls without spinning up Web Audio.
const stubDir = mkdtempSync(resolve(tmpdir(), "acs-rt-"));
const stubAudio = `
let workletReady = false;
let workletCalls = [];
export function isWorkletReady() { return workletReady; }
export function workletVoice(opts) { workletCalls.push(opts); }
export function _setReady(v) { workletReady = v; }
export function _calls() { return workletCalls; }
export function _reset() { workletReady = false; workletCalls = []; }
`;
writeFileSync(resolve(stubDir, "audio.js"), stubAudio);

// Copy the real modules dsp.js depends on into the stub dir, redirected.
for (const f of ["parse.js", "quality.js"]) {
  writeFileSync(resolve(stubDir, f), readFileSync(resolve(RUNTIME, f), "utf8"));
}
// Patch dsp.js to import from the stub dir's audio.js (same relative path).
let dspSrc = readFileSync(resolve(RUNTIME, "dsp.js"), "utf8");
writeFileSync(resolve(stubDir, "dsp.js"), dspSrc);

const stub = await import(resolve(stubDir, "audio.js"));
const { playLayer, playPluckLayer, playModalLayer } = await import(resolve(stubDir, "dsp.js"));

// Minimal AudioContext stub.
function makeNode() {
  return {
    connect(t) { return t; },
    disconnect() {},
    start() {}, stop() {},
    type: "", frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    Q: { value: 0 }, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    curve: null, detune: { value: 0 },
    buffer: null, playbackRate: { value: 1 },
    pan: { value: 0 },
    setPeriodicWave() {},
    getChannelData() { return new Float32Array(1024); },
  };
}
function makeCtx() {
  return {
    sampleRate: 48000,
    currentTime: 0,
    createGain: makeNode, createBiquadFilter: makeNode, createWaveShaper: makeNode,
    createOscillator: makeNode, createBufferSource: makeNode, createStereoPanner: makeNode,
    createBuffer: () => ({ getChannelData: () => new Float32Array(1024) }),
    createIIRFilter: () => makeNode(),
    createPeriodicWave: () => ({}),
  };
}

const ctx = makeCtx();
const dest = makeNode();

// 1. realtime: true + worklet not ready → main-thread (no worklet calls).
{
  stub._reset();
  playPluckLayer(ctx, { pluck: "440hz", decay: "200ms", realtime: "true" }, { dest, volume: 0.5 });
  check("pluck + realtime + !ready → main-thread", stub._calls().length === 0);
}

// 2. realtime: true + worklet ready → worklet kind=3 (pluck).
{
  stub._reset();
  stub._setReady(true);
  playPluckLayer(ctx, { pluck: "440hz", decay: "200ms", realtime: "true" }, { dest, volume: 0.5 });
  check("pluck + realtime + ready → worklet", stub._calls().length === 1);
  check("pluck → kind=3", stub._calls()[0]?.kind === 3);
  stub._reset();
}

// Helper: clear calls but keep readiness state.
function clearCalls() {
  while (stub._calls().length) stub._calls().pop();
}

// 3. realtime: true + filter present → fallback (worklet doesn't support filters).
{
  stub._setReady(true);
  clearCalls();
  playPluckLayer(ctx, { pluck: "440hz", filter: "lowpass", cutoff: "1000hz", realtime: "true" }, { dest, volume: 0.5 });
  check("pluck + filter + realtime → fallback (no worklet call)", stub._calls().length === 0);
}

// 4. Modal single-mode + realtime → worklet kind=2.
{
  stub._setReady(true);
  clearCalls();
  playModalLayer(ctx, { modal: "1200hz", ratios: "1", decays: "0.2s", realtime: "true" }, { dest, volume: 0.5 });
  check("modal single + realtime → worklet kind=2",
    stub._calls().length === 1 && stub._calls()[0].kind === 2);
}

// 5. Modal multi-mode + realtime → fallback (only single-mode supported).
{
  stub._setReady(true);
  clearCalls();
  playModalLayer(ctx, { modal: "1200hz", ratios: "1, 2.4", decays: "0.2s, 0.1s", realtime: "true" }, { dest, volume: 0.5 });
  check("modal multi + realtime → fallback", stub._calls().length === 0);
}

// 6. realtime missing/false → main-thread regardless of worklet readiness.
{
  stub._setReady(true);
  clearCalls();
  playPluckLayer(ctx, { pluck: "440hz", decay: "200ms" }, { dest, volume: 0.5 });
  check("no realtime flag → main-thread", stub._calls().length === 0);
  clearCalls();
  playPluckLayer(ctx, { pluck: "440hz", decay: "200ms", realtime: "false" }, { dest, volume: 0.5 });
  check("realtime: false → main-thread", stub._calls().length === 0);
}

// 7. osc:sine + realtime + no filter → worklet kind=0 (sine tap).
{
  stub._setReady(true);
  clearCalls();
  playLayer(ctx, { osc: "sine", freq: "880hz", attack: "1ms", decay: "30ms", realtime: "true" }, { dest, volume: 0.5 });
  check("osc:sine + realtime → worklet kind=0",
    stub._calls().length === 1 && stub._calls()[0].kind === 0);
}

// 8. noise + realtime + lowpass → worklet kind=1.
{
  stub._setReady(true);
  clearCalls();
  playLayer(ctx, { noise: "white", filter: "lowpass", cutoff: "3500hz", attack: "0.5ms", decay: "25ms", realtime: "true" }, { dest, volume: 0.5 });
  check("noise + lowpass + realtime → worklet kind=1",
    stub._calls().length === 1 && stub._calls()[0].kind === 1);
}

// 9. osc:triangle + realtime → fallback (worklet only handles sine via kind=0).
{
  stub._setReady(true);
  clearCalls();
  playLayer(ctx, { osc: "triangle", freq: "880hz", attack: "1ms", decay: "30ms", realtime: "true" }, { dest, volume: 0.5 });
  check("osc:triangle + realtime → fallback", stub._calls().length === 0);
}

if (fails === 0) console.log("\n✓ All realtime tests passed.");
else console.log(`\n✗ ${fails} failure${fails === 1 ? "" : "s"}.`);
process.exit(fails);
