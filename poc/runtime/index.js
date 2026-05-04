/* index.js — main entry, orchestrates parse → cascade → bind.
 */

import {
  parse,
  parseLayer,
  parsePitch,
  parseVolume,
  parseVolumeRaw,
  parseSynthArgs,
  parseTime,
  parseSequence,
  resolveVar,
} from "./parse.js";
import { ensureCtx, getDest, configureMaster } from "./audio.js";
import {
  playSynth,
  playUrl,
  makeSoundFromLayers,
} from "./dsp.js";
import { presets } from "./presets.js";
import { buildBindings } from "./cascade.js";
import { matchMediaQuery, installModalityTracker, onModalityChange } from "./media.js";
import { bindRoot, setResolver, setTrigger } from "./dom.js";
import {
  calibrate,
  getCalibrationFactor,
  setEnabled as setCalibrationEnabled,
  isEnabled as isCalibrationEnabled,
  invalidateFactor,
  _factors,
  _setFactor,
} from "./calibrate.js";
import { shouldThrottle } from "./throttle.js";
import { applyMood } from "./mood.js";
import * as voicePool from "./voicepool.js";
import {
  validateRuleDecls,
  validateLayer,
  validateUnknownSound,
} from "./validate.js";
import * as devtools from "./devtools.js";
import * as helpers from "./helpers.js";

// Walk a flat decls object and substitute any `var(--name)` references
// against `:root`'s computed CSS custom properties. Skips internal keys
// (those starting with __) and non-string values.
function resolveDeclsVars(decls) {
  let dirty = false;
  const out = {};
  for (const k in decls) {
    const v = decls[k];
    if (typeof v === "string" && v.includes("var(")) {
      const r = resolveVar(v);
      out[k] = r;
      if (r !== v) dirty = true;
    } else {
      out[k] = v;
    }
  }
  return dirty ? out : decls;
}

// Runtime-wide mute gate. When false, triggerNow() returns early — so
// every code path (DOM event delegation, IntersectionObserver on-appear,
// direct ACS.trigger / ACS.helpers.play, sequence steps) is silenced
// uniformly. The cascade itself keeps running so resolveFor / observers
// still work; only the audio output is suppressed. Distinct from the
// `enableAutoLoudness` flag (which only toggles calibration measurement).
let runtimeEnabled = true;

// User-defined @sound blocks register here at load time.
const customPresets = {};
// @sound-keyframes blocks register here, keyed by name.
const keyframes = {};
// @sample <name> url("...") — sample files registered under a name so
// users write `sound: my-thump` and the runtime fetches/plays the file.
// Maps preset-name → URL; runner-resolution wraps it in playUrl.
const sampleRegistry = {};

// Resolve a preset name to its (ctx, opts) => void runner, or null.
// Order: user-defined @sound > built-in procedural > registered @sample.
// (User overrides win; samples are last so a user-defined `@sound my-thump`
//  takes precedence over a `@sample my-thump url(...)` on the same name.)
function resolvePresetRunner(name) {
  if (customPresets[name]) return customPresets[name];
  if (presets[name]) return presets[name];
  if (sampleRegistry[name]) {
    const url = sampleRegistry[name];
    return (ctx, opts) => playUrl(ctx, url, opts);
  }
  return null;
}

// Observers fire when a sound actually plays (after throttle passes,
// after sequence step resolution). Devtools / debug overlays subscribe
// via window.ACS.onTrigger(cb) to surface preset names regardless of
// whether the trigger came from a DOM event or a direct ACS.trigger().
const triggerObservers = new Set();
function notifyObservers(presetName, decls, sourceElement) {
  if (!triggerObservers.size || !presetName) return;
  for (const cb of triggerObservers) {
    try { cb(presetName, decls, sourceElement); }
    catch (e) { console.warn("[acs] trigger observer error:", e); }
  }
}

export function trigger(decls, key, sourceElement) {
  // sound-delay: schedule the actual trigger work later. Best-effort
  // via setTimeout — fine for UI sounds (~ms accuracy), not sample-
  // accurate audio sequencing.
  const delayStr = decls["sound-delay"];
  if (delayStr) {
    const delay = parseTime(delayStr, 0);
    if (delay > 0) {
      setTimeout(() => triggerNow(decls, key, sourceElement), delay * 1000);
      return;
    }
  }
  triggerNow(decls, key, sourceElement);
}

function triggerNow(decls, key, sourceElement) {
  if (!decls || typeof decls !== "object") return;
  if (!runtimeEnabled) return;
  const c = ensureCtx();
  // CSS-var bridge: resolve `var(--name)` in any string-typed decl. Numeric
  // parsers (parseFreq/Time/Pitch/Volume) handle var() internally too, so
  // this only needs to cover the string-routed values (sound, room, mood,
  // sound-mood-mix, sound-sequence, etc.). Done up-front once per trigger
  // so downstream code reads plain values.
  decls = resolveDeclsVars(decls);
  let dest = getDest(decls["room"]);
  // sound-mood inserts a filter chain between preset and room destination.
  // sound-mood-mix (0..1) wet/dry-blends the mood — 0 bypasses, 1 (default)
  // is full mood. Useful when an inherited mood needs to be partially
  // dialed back on a specific subtree without a full override.
  const mood = decls["sound-mood"];
  if (mood) {
    const mix = decls["sound-mood-mix"];
    const mixVal = mix === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(mix)));
    dest = applyMood(c, mood, dest, isFinite(mixVal) ? mixVal : 1);
  }

  // velocity-filter: low user-volume optionally darkens the timbre.
  // `!raw` modifier (e.g. `volume: 0.5 !raw`) bypasses calibration —
  // sound designers want exact control without auto-loudness scaling.
  const volSpec = parseVolumeRaw(decls["volume"]);
  const userVolume = volSpec ? volSpec.value : undefined;
  const rawVolume = volSpec ? volSpec.raw : false;
  // velocity-filter: on | subtle | aggressive | off (default).
  //   on        — standard 800-8000 Hz LP based on volume in [0..1]
  //   subtle    — gentle 1500-12000 Hz LP, less obvious
  //   aggressive — heavy 300-6000 Hz LP, dramatic darkening for soft hits
  // Real-instrument feel: piano keys hit softer = darker, harder = brighter.
  const vf = decls["velocity-filter"];
  if (vf && vf !== "off" && userVolume !== undefined && userVolume < 1.0) {
    let lo = 800, hi = 8000, q = 0.5;
    if (vf === "subtle") { lo = 1500; hi = 12000; }
    else if (vf === "aggressive") { lo = 300; hi = 6000; q = 0.7; }
    const v = Math.max(0, Math.min(1, userVolume));
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lo + v * (hi - lo);
    lp.Q.value = q;
    lp.connect(dest);
    dest = lp;
  }

  // pan: auto — derive stereo pan from element's viewport x-center.
  if (decls["pan"] === "auto" && sourceElement && sourceElement.getBoundingClientRect) {
    const rect = sourceElement.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / Math.max(1, window.innerWidth);
    const pan = Math.max(-1, Math.min(1, (cx - 0.5) * 2));
    const pn = c.createStereoPanner();
    pn.pan.value = pan;
    pn.connect(dest);
    dest = pn;
  } else if (decls["pan"] !== undefined && decls["pan"] !== "auto") {
    const pn = c.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, parseFloat(decls["pan"]) || 0));
    pn.connect(dest);
    dest = pn;
  }

  const value = decls[key] || decls["sound"];

  // Sequence: either inline (`sound-sequence: tap 0ms, pop 100ms, ...`)
  // or referenced by name (`sound: my-seq` where my-seq is a registered
  // @sound-keyframes block). Schedule each step via setTimeout — fine for
  // UI sequencing where ms-level accuracy is enough.
  const seqDur = parseTime(decls["sound-duration"], 1.0);
  const inlineSeq = decls["sound-sequence"];
  if (inlineSeq) {
    parseSequence(inlineSeq, seqDur).forEach((step) => {
      const stepDecls = { ...decls, sound: step.sound, "sound-sequence": "" };
      setTimeout(() => triggerNow(stepDecls, key, sourceElement), step.at * 1000);
    });
    return;
  }
  if (value && keyframes[value]) {
    keyframes[value].forEach((kf) => {
      const stepDecls = { ...decls, ...kf.decls, sound: kf.sound };
      setTimeout(() => triggerNow(stepDecls, key, sourceElement), kf.at * 1000);
    });
    return;
  }
  if (!value) return;
  // Explicit silence — CSS-style "none" / "silent" disables sound for
  // this event (useful for cascade overrides: `.x.muted { sound: none; }`).
  if (value === "none" || value === "silent") return;

  // Rate-limit: drops accidental double-fires + spam-protect.
  if (shouldThrottle(value, performance.now())) return;

  // Skip silent triggers (volume=0) early. Reduces noise for observers
  // and avoids creating audio nodes that just route silence.
  const baseVol = userVolume === undefined ? 0.5 : userVolume;
  if (baseVol === 0) return;

  // Notify observers — only for actually-playing sounds (post-throttle,
  // post-mute). Centralized here so DOM-event triggers and direct
  // .trigger() calls both reach subscribers without wrapping window.ACS.
  notifyObservers(value, decls, sourceElement);

  const opts = {
    pitchMul: parsePitch(decls["pitch"]),
    dest,
  };

  const runner = resolvePresetRunner(value);
  if (runner) {
    const factor = rawVolume ? 1.0 : getCalibrationFactor(value);
    opts.volume = baseVol * factor;
    // Voice pool: cap concurrent voices per preset so spam-clicking
    // doesn't pile up nodes. The voice's gain sits between the preset's
    // output and the destination so we can fade the oldest gracefully.
    const voice = voicePool.acquire(c, value, 2.0);
    voice.gain.connect(opts.dest);
    opts.dest = voice.gain;
    runner(c, opts);

    // Lazy-calibrate this preset in the background if we haven't yet.
    // First few triggers may sound off; subsequent triggers are leveled.
    if (factor === 1.0 && !rawVolume) {
      calibrate(value, runner, c.sampleRate);
    }
    return;
  }

  // Inline synth() / url() — no calibration (each call is unique).
  if (userVolume !== undefined) opts.volume = userVolume;

  const synthMatch = value.match(/^synth\(([\s\S]+)\)$/);
  if (synthMatch) {
    playSynth(c, parseSynthArgs(synthMatch[1]), opts);
    return;
  }
  const urlMatch = value.match(/^url\(["']?(.+?)["']?\)$/);
  if (urlMatch) {
    playUrl(c, urlMatch[1], opts);
    return;
  }
  // Unknown — emit a friendly warning with fuzzy-match hint.
  const available = new Set([
    ...Object.keys(presets),
    ...Object.keys(customPresets),
    ...Object.keys(sampleRegistry),
  ]);
  validateUnknownSound(value, available);
}

export function bindAll(rules, root = document) {
  if (!Array.isArray(rules)) {
    console.warn("[acs] bindAll expects an array of rules; got", typeof rules);
    return;
  }
  rememberAndRebind(rules, root);
  // Filter by @media condition first (skip rules whose media doesn't match).
  const active = rules.filter(
    (r) => !r.mediaCondition || matchMediaQuery(r.mediaCondition)
  );

  // Reset customPresets so re-binds (live reload) start clean. Tracking
  // whether a name was already-defined this pass tells us if a later
  // @sound is an override (invalidate baked factor) vs first definition
  // (keep baked factor — it was measured for this exact preset).
  for (const k of Object.keys(customPresets)) delete customPresets[k];
  for (const k of Object.keys(keyframes)) delete keyframes[k];
  for (const k of Object.keys(sampleRegistry)) delete sampleRegistry[k];

  const rootDecls = {};
  const rest = [];
  for (const r of active) {
    if (r.selector === ":root" || r.selector === "html") {
      Object.assign(rootDecls, r.decls);
    } else if (r.selector.startsWith("@sound-keyframes ")) {
      const name = r.selector.slice("@sound-keyframes ".length).trim();
      if (Array.isArray(r.decls.__sequence)) {
        keyframes[name] = r.decls.__sequence;
      }
    } else if (r.selector.startsWith("@sample ")) {
      const name = r.selector.slice("@sample ".length).trim();
      if (typeof r.decls.url === "string" && r.decls.url) {
        sampleRegistry[name] = r.decls.url;
      }
    } else if (r.selector.startsWith("@sound ")) {
      const name = r.selector.slice("@sound ".length).trim();
      const layerEntries = Object.entries(r.decls);
      const layers = layerEntries.map(([layerName, val]) => {
        // Two forms supported:
        //   1) Nested CSS-vari block: val is already an object of {key: value}
        //   2) Inline (legacy): val is "key: v, key: v" string → parseLayer
        const layer = typeof val === "string" ? parseLayer(val) : val;
        validateLayer(name, layerName, layer);
        return layer;
      });
      if (layers.length) {
        // First definition this pass keeps the baked factor (built-in
        // defaults.acs comes first, so its @sound matches the baked
        // measurement). A later definition with the same name is a user
        // override — different DSP, baked factor no longer applies.
        const isOverride = customPresets[name] !== undefined;
        customPresets[name] = makeSoundFromLayers(layers);
        if (isOverride) invalidateFactor(name);
      }
    } else {
      validateRuleDecls(r.selector, r.decls);
      rest.push(r);
    }
  }

  if (Object.keys(rootDecls).length) {
    // Don't ensureCtx() here — that creates the AudioContext before any
    // user gesture and triggers Chrome's autoplay-policy warning.
    // configureMaster() stashes decls when ctx is missing and the
    // runtime flushes them at first real trigger.
    configureMaster(rootDecls);
    // Forward inheritable properties (mood/pitch/pan/velocity-filter/etc.)
    // from :root to a synthetic body rule — configureMaster only handles
    // master volume/EQ/room, so otherwise these are silently dropped.
    const MASTER_KEYS = new Set([
      "master-volume", "master-eq-low", "master-eq-high",
      "room", "room-mix", "quality",
    ]);
    const inherited = {};
    for (const k of Object.keys(rootDecls)) {
      if (!MASTER_KEYS.has(k)) inherited[k] = rootDecls[k];
    }
    if (Object.keys(inherited).length) {
      rest.unshift({ selector: "body", decls: inherited });
    }
  }

  setResolver(buildBindings(rest));
  setTrigger(trigger);
  bindRoot(root);

  // Pre-calibrate every known preset in the background. By the time the
  // user clicks anything, most factors are already cached. OfflineAudio
  // doesn't need a user gesture so this runs without blocking startup.
  schedulePrecalibration();

  // Track input modality so @media (input-modality: ...) can match.
  // Re-bind on change so freshly-active rules apply.
  installModalityTracker();
}

let lastBoundRules = null;
let lastBoundRoot = null;
let modalityRebindHooked = false;
function rememberAndRebind(rules, root) {
  lastBoundRules = rules;
  lastBoundRoot = root;
  if (!modalityRebindHooked) {
    modalityRebindHooked = true;
    onModalityChange(() => {
      if (lastBoundRules) bindAll(lastBoundRules, lastBoundRoot);
    });
  }
}

function schedulePrecalibration() {
  const sr = 48000;
  const all = new Set([
    ...Object.keys(presets),
    ...Object.keys(customPresets),
  ]);
  for (const name of all) {
    const runner = resolvePresetRunner(name);
    if (runner) calibrate(name, runner, sr);
  }
}

async function loadStylesheets() {
  const allRules = [];
  const loadedUrls = new Set();

  const fetchAndPush = async (url) => {
    if (loadedUrls.has(url)) return; // dedupe — defaults.acs may be both auto-loaded AND link-rel'd
    loadedUrls.add(url);
    try {
      // Cache-bust .acs files — browsers aggressively cache them and
      // stale stylesheet content is silently mismatched against fresh
      // runtime.js, producing confusing "I changed it but it didn't apply"
      // bugs. This is dev-mode behavior; in prod the URLs would be hashed.
      const sep = url.includes("?") ? "&" : "?";
      const res = await fetch(url + sep + "_=" + Date.now());
      if (res.ok) allRules.push(...parse(await res.text()));
    } catch (e) {
      console.warn("[acs] failed to load", url, e);
    }
  };

  // Auto-load defaults.acs alongside the runtime module — unless the
  // page has it explicitly link-rel'd (we'd double-load and double-
  // register every @sound, breaking BAKED_FACTORS via the override path).
  const defaultsUrl = new URL("../defaults.acs", import.meta.url).href;
  const linkUrls = Array.from(document.querySelectorAll('link[rel="audiostyle"]'))
    .map((l) => l.href);
  if (!linkUrls.some((u) => u === defaultsUrl || u.endsWith("/defaults.acs"))) {
    await fetchAndPush(defaultsUrl);
  }
  for (const url of linkUrls) await fetchAndPush(url);
  if (allRules.length) bindAll(allRules);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadStylesheets);
} else {
  loadStylesheets();
}

// Live-reload — poll a stylesheet URL on an interval and re-bind on change.
// Useful during development. Opt-in:
//   window.ACS.watch("/demo.acs");
// Multiple watchers can be registered (one per file).
const watchers = new Map();
async function fetchAllStylesheets() {
  const all = [];
  const loaded = new Set();
  const cbVal = "_=" + Date.now();
  const withCb = (url) => url + (url.includes("?") ? "&" : "?") + cbVal;
  const grab = async (url) => {
    const key = url.split("?")[0];
    if (loaded.has(key)) return;
    loaded.add(key);
    try {
      const res = await fetch(withCb(url));
      if (res.ok) all.push(...parse(await res.text()));
    } catch (e) {}
  };
  const defaultsUrl = new URL("../defaults.acs", import.meta.url).href;
  const linkUrls = Array.from(document.querySelectorAll('link[rel="audiostyle"]'))
    .map((l) => l.href);
  if (!linkUrls.some((u) => u === defaultsUrl || u.endsWith("/defaults.acs"))) {
    await grab(defaultsUrl);
  }
  for (const url of linkUrls) await grab(url);
  return all;
}
function watch(url, intervalMs = 1000) {
  if (watchers.has(url)) return;
  let lastText = null;
  const id = setInterval(async () => {
    try {
      const res = await fetch(url + "?_=" + Date.now());
      if (!res.ok) return;
      const text = await res.text();
      if (lastText !== null && text !== lastText) {
        const all = await fetchAllStylesheets();
        if (all.length) {
          console.log("[acs] hot reload:", url);
          bindAll(all);
        }
      }
      lastText = text;
    } catch (e) {}
  }, intervalMs);
  watchers.set(url, id);
}
function unwatch(url) {
  const id = watchers.get(url);
  if (id) {
    clearInterval(id);
    watchers.delete(url);
  }
}

// Render any preset offline and return the actual peak/RMS the runtime
// produces — for diagnosing "why is X quiet" without ear-guessing.
async function probe(name, opts = {}) {
  const runner = resolvePresetRunner(name);
  if (!runner) throw new Error("unknown preset: " + name);
  const sr = 48000;
  const offline = new OfflineAudioContext(1, Math.ceil(sr * 1.5), sr);
  const factor = getCalibrationFactor(name);
  const baseVol = opts.volume ?? 0.5;
  runner(offline, {
    dest: offline.destination,
    volume: baseVol * factor,
    pitchMul: opts.pitchMul ?? 1,
  });
  const buf = await offline.startRendering();
  const ch = buf.getChannelData(0);
  let peak = 0, sumSq = 0, firstAudible = -1, lastAudible = -1;
  const THRESH = 0.01;
  for (let i = 0; i < ch.length; i++) {
    const a = Math.abs(ch[i]);
    if (a > peak) peak = a;
    sumSq += ch[i] * ch[i];
    if (a >= THRESH) {
      if (firstAudible < 0) firstAudible = i;
      lastAudible = i;
    }
  }
  const rms = Math.sqrt(sumSq / ch.length);
  // RMS over the active region only (where signal > 1% of peak).
  let activeSum = 0, activeCount = 0;
  if (firstAudible >= 0) {
    for (let i = firstAudible; i <= lastAudible; i++) {
      activeSum += ch[i] * ch[i];
      activeCount++;
    }
  }
  const activeRms = activeCount > 0 ? Math.sqrt(activeSum / activeCount) : 0;
  const activeDuration = activeCount / sr;
  const dB = (x) => x < 1e-9 ? -Infinity : 20 * Math.log10(x);
  const out = {
    name,
    factor,
    appliedVolume: +(baseVol * factor).toFixed(4),
    peak: +peak.toFixed(4),
    peakDB: +dB(peak).toFixed(1),
    rms: +rms.toFixed(4),
    rmsDB: +dB(rms).toFixed(1),
    activeRms: +activeRms.toFixed(4),
    activeRmsDB: +dB(activeRms).toFixed(1),
    activeMs: +(activeDuration * 1000).toFixed(0),
  };
  console.log(`[probe] ${name}:`, out);
  return out;
}

// Probe several presets and print a side-by-side table.
async function probeAll(...names) {
  const rows = [];
  for (const n of names) {
    try { rows.push(await probe(n)); }
    catch (e) { rows.push({ name: n, error: e.message }); }
  }
  console.table(rows, ["name", "factor", "peakDB", "rmsDB", "activeRmsDB", "activeMs"]);
  return rows;
}

// Expose for debugging / live-reload / overrides.
window.ACS = {
  parse,
  parseLayer,
  // Build a runner from an array of parsed layer objects (the same
  // shape `parseLayer` returns). Useful for hosts that want to
  // register a synthesized preset without rebinding the whole
  // cascade — e.g. the picker's layer editor auditioning live edits.
  makeSoundFromLayers,
  presets,
  customPresets,
  trigger,
  bindAll,
  probe,
  probeAll,
  voicePool,
  calibrationFactors: _factors,
  setCalibrationFactor: _setFactor,
  watch,
  unwatch,
  // Manual re-fetch of all <link rel="audiostyle"> + defaults.acs and
  // re-bind. Use after dynamically swapping a theme link.href.
  reload: async () => {
    const all = await fetchAllStylesheets();
    if (all.length) bindAll(all);
  },
  // Direct master-level config update without touching the cascade
  // bindings. Use for room/EQ/volume swaps when you don't want to reload
  // the whole stylesheet (e.g., a "skin" picker that overrides room).
  // Pass an object: { room, "master-volume", "master-eq-low",
  // "master-eq-high", "room-mix" }. Unspecified keys reset to default.
  setMasterConfig: (decls) => {
    ensureCtx();
    configureMaster(decls || {});
  },
  // Subscribe to every trigger (UI/DOM events + direct calls). Returns
  // unsubscribe fn. Useful for devtools / debug overlays / now-playing.
  onTrigger: (cb) => {
    triggerObservers.add(cb);
    return () => triggerObservers.delete(cb);
  },
  enableAutoLoudness: (v = true) => setCalibrationEnabled(v),
  isAutoLoudnessEnabled: isCalibrationEnabled,
  // Master mute. setEnabled(false) silences every trigger path —
  // cascade-driven (click / on-appear / on-input), direct trigger(),
  // and helpers.play(). Distinct from master-volume (which preserves
  // master gain math but routes audio through 0× gain — calibration
  // still measures the silent output).
  setEnabled: (v = true) => { runtimeEnabled = !!v; },
  isEnabled: () => runtimeEnabled,
  // Devtools — opt-in overlay that subscribes to onTrigger and surfaces
  // preset/factor/mood/room state. Zero overhead until mount() is called.
  devtools,
  // Framework-agnostic adapter helpers: play/attach/useSound. Cover the
  // "I want to fire a preset from JS without building decls by hand" use
  // case (async API resolution, state-change notifications, etc.).
  helpers,
};
