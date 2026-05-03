/* voicepool.js — per-preset polyphony cap with oldest-voice stealing.
 *
 * Without a cap, rapid trigger spam (mash-clicking, scroll-snap firing
 * dozens of events) accumulates Web Audio nodes faster than they can be
 * GC'd, eventually overwhelming the master limiter. This module tracks
 * active voices per preset, prunes finished ones lazily, and gracefully
 * fades out the oldest voice when a new one would exceed the cap.
 *
 * Usage from playLayer / playSynth:
 *   const voice = voicePool.acquire(ctx, presetName, expectedDurationSec);
 *   // wire the layer's final gain node into voice.gain (so we can fade it)
 *   voice.gain.gain ... // your envelope
 *   // when started: schedule cleanup
 *   voice.scheduleEnd(stopTime);
 */

import { getQualityProfile } from "./quality.js";

const STEAL_FADE_SEC = 0.015; // 15 ms — short enough to feel instant, long enough to avoid click

const pools = new Map(); // presetName → Set<voice>
const caps = new Map();  // presetName → cap (override default via setCap)

export function setCap(presetName, n) {
  caps.set(presetName, Math.max(1, n | 0));
}

function poolFor(name) {
  let p = pools.get(name);
  if (!p) { p = new Set(); pools.set(name, p); }
  return p;
}

function pruneFinished(pool, nowSec) {
  for (const v of pool) {
    if (v.endTime <= nowSec) pool.delete(v);
  }
}

function steal(oldest, ctx) {
  // Quick-fade then disconnect. We don't disconnect the underlying source
  // nodes (they self-stop); we just yank the voice's gain to silence.
  // cancelAndHoldAtTime (where supported) snaps to the actual playback
  // value at `now` instead of trusting g.value (which only reflects the
  // last JS-set value, not what an in-progress ramp is producing). Without
  // it, stealing mid-ramp can introduce a click. Falls back gracefully.
  try {
    const g = oldest.gain.gain;
    const now = ctx.currentTime;
    if (typeof g.cancelAndHoldAtTime === "function") {
      g.cancelAndHoldAtTime(now);
    } else {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
    }
    g.linearRampToValueAtTime(0, now + STEAL_FADE_SEC);
  } catch (e) {}
  oldest.endTime = ctx.currentTime + STEAL_FADE_SEC;
}

// Acquire a voice handle for `presetName`. Returns { gain, scheduleEnd }.
// Caller MUST connect their layer chain through `gain` and call
// scheduleEnd(stopTime) so the pool knows when the voice frees up.
export function acquire(ctx, presetName, expectedDurationSec = 1.0) {
  const pool = poolFor(presetName);
  const cap = caps.get(presetName) ?? getQualityProfile().voiceCap;
  pruneFinished(pool, ctx.currentTime);

  if (pool.size >= cap) {
    // Steal oldest — sort by start time and yank.
    let oldest = null;
    for (const v of pool) {
      if (!oldest || v.startTime < oldest.startTime) oldest = v;
    }
    if (oldest) {
      steal(oldest, ctx);
      pool.delete(oldest);
    }
  }

  const gain = ctx.createGain();
  gain.gain.value = 1.0;
  const voice = {
    gain,
    startTime: ctx.currentTime,
    endTime: ctx.currentTime + expectedDurationSec,
    scheduleEnd(stopTime) {
      voice.endTime = stopTime;
    },
  };
  pool.add(voice);
  return voice;
}

// Diagnostic: current voice counts per preset.
export function _stats() {
  const out = {};
  for (const [name, pool] of pools) out[name] = pool.size;
  return out;
}
