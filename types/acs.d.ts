/**
 * ACS — TypeScript type definitions for the runtime API and stylesheet DSL.
 *
 * The runtime is loaded as an ES module:
 *   <script type="module" src="runtime.js"></script>
 * Once loaded, `window.ACS` is populated with the public API below.
 */

// ---------- Stylesheet DSL ----------

/** Built-in oscillator waveform types. */
export type OscType = "sine" | "square" | "sawtooth" | "saw" | "triangle";

/** Built-in noise color. */
export type NoiseKind = "white" | "pink";

/** Standard Web Audio biquad types + ACS TPT-SVF variants. */
export type FilterType =
  | "lowpass" | "highpass" | "bandpass"
  | "lowshelf" | "highshelf" | "peaking" | "notch" | "allpass"
  | "tpt-lp" | "tpt-hp" | "tpt-bp" | "tpt-notch" | "tpt-peak";

/** Built-in mood transforms (orthogonal filter chains). */
export type Mood =
  | "warm" | "bright" | "glassy" | "metallic" | "organic"
  | "punchy" | "retro" | "airy" | "lofi";

/** Built-in room presets (reverb topologies). */
export type Room =
  | "none" | "small-room" | "medium-room" | "large-hall" | "chamber" | "plate";

/** Velocity-filter modes. */
export type VelocityFilter = "off" | "on" | "subtle" | "aggressive";

/** Frequency string ("440hz", "1.5khz") or unitless number. */
export type FreqValue = string | number;

/** Time string ("100ms", "0.5s") — bare number is seconds. */
export type TimeValue = string | number;

/** Layer definition inside an `@sound` block. One source per layer. */
export interface SoundLayer {
  /** Modal resonator — fundamental + ratios + decays + gains. */
  modal?: FreqValue;
  /** Additive sine-sum partial layer — clean, "professional" UI tones. */
  tones?: FreqValue;
  /** Karplus-Strong pluck — string-like sustained tone. */
  pluck?: FreqValue;
  /** Tonal oscillator. */
  osc?: OscType;
  /** Noise burst (white/pink) — used when modal/pluck/osc absent. */
  noise?: NoiseKind;

  /** Modal: comma- or space-separated harmonic ratios e.g. "1, 1.7, 2.4". */
  ratios?: string;
  /** Modal: per-partial t60 decay times. */
  decays?: string;
  /** Modal: per-partial relative gains. */
  gains?: string;
  /** Karplus-Strong: 0..1 brightness (filter coefficient). */
  brightness?: string | number;
  /** Karplus-Strong / osc / noise: total decay time. */
  decay?: TimeValue;

  /** Osc: base frequency. */
  freq?: FreqValue;
  /** Osc: pitch sweep starts at this freq, exponential ramp to `freq`. */
  "pitch-from"?: FreqValue;
  /** Osc: detune in cents. */
  detune?: string | number;

  /** FM modulation source waveform. */
  "fm-mod"?: OscType;
  /** FM modulator-to-carrier frequency ratio. */
  "fm-ratio"?: string | number;
  /** FM modulator amplitude (Hz at the carrier's freq Param). */
  "fm-depth"?: string | number;

  /** Optional bandpass/lowpass/highpass on the layer source. */
  filter?: FilterType;
  /** Filter cutoff (uses pitchMul for noise; not for osc). */
  cutoff?: FreqValue;
  /** Filter Q. */
  q?: string | number;

  /** Attack time (seconds). */
  attack?: TimeValue;

  /** Layer output gain multiplier. */
  gain?: string | number;
  /** Saturation drive (1..3+). Adds harmonics. */
  saturation?: string | number;
  /** Alias for saturation. */
  drive?: string | number;

  /** Stereo pan in [-1, +1]. */
  pan?: string | number;
  /** Noise envelope shape exponent (default 0.7). */
  shape?: string | number;
  /** Schedule layer relative to trigger (seconds). */
  start?: TimeValue;

  /** Opt into the AudioWorklet voice processor for sub-1 ms latency.
   *  Only applies to single-mode modal/pluck or simple osc:sine / noise
   *  layers without a per-layer filter; falls back to main-thread when
   *  the worklet isn't ready or the layer is too complex. */
  realtime?: boolean | "true" | "false";
}

/** Top-level `@sound <name> { ... }` definition: a map of layer name → layer. */
export interface SoundDef { [layerName: string]: SoundLayer; }

/** Top-level cascade declarations attached to a selector. */
export interface RuleDecls {
  sound?: string;
  "sound-on-click"?: string;
  "sound-on-enter"?: string;
  "sound-on-focus"?: string;
  "sound-on-input"?: string;
  "sound-on-appear"?: string;
  "sound-on-leave"?: string;

  /** 0..2 (clamped). Suffix " !raw" bypasses calibration. */
  volume?: string | number;
  /** Pitch multiplier ("12st" semitones, or float). */
  pitch?: string | number;
  /** Stereo pan: number in [-1,+1] or "auto" (element-position). */
  pan?: string | number | "auto";

  room?: Room;
  /** Override per-room dry/wet mix (0..1). */
  "room-mix"?: string | number;
  "sound-mood"?: Mood;
  /** Wet/dry blend for sound-mood (0 = bypass, 1 = full mood). */
  "sound-mood-mix"?: string | number;
  /** Schedule the trigger by this delay (seconds). */
  "sound-delay"?: TimeValue;

  /** Inline sequence: "tap 0ms, pop 100ms, bell 200ms". */
  "sound-sequence"?: string;
  /** Total sequence duration (controls % keyframe positions). */
  "sound-duration"?: TimeValue;

  "master-volume"?: string | number;
  "master-eq-low"?: string;
  "master-eq-high"?: string;
  "background-volume"?: string | number;

  "velocity-filter"?: VelocityFilter;

  /** Global CPU/quality knob — only effective on `:root`. */
  quality?: "low" | "medium" | "high";
}

// ---------- Runtime API ----------

/** Trigger options — extracted from cascade decls. */
export interface TriggerOptions {
  pitchMul: number;
  dest: AudioNode;
  volume?: number;
}

/** Probe result — actual peak/RMS measured by rendering offline. */
export interface ProbeResult {
  name: string;
  factor: number;
  appliedVolume: number;
  peak: number;
  peakDB: number;
  rms: number;
  rmsDB: number;
  activeRms: number;
  activeRmsDB: number;
  activeMs: number;
}

/** Public runtime API exposed on `window.ACS`. */
export interface ACSRuntime {
  /** Parse a stylesheet string → array of rules. */
  parse(source: string): Array<{
    selector: string;
    decls: any;
    mediaCondition?: string;
  }>;
  /** Built-in procedural presets (tap, click, pop, etc.). */
  presets: Record<string, (ctx: AudioContext, opts: TriggerOptions) => void>;
  /** Custom presets registered via `@sound` blocks. */
  customPresets: Record<string, (ctx: AudioContext, opts: TriggerOptions) => void>;
  /** Trigger a preset programmatically. */
  trigger(decls: RuleDecls, key?: string, sourceElement?: Element | null): void;
  /** Bind cascade rules + start delegation listeners. */
  bindAll(rules: Array<any>, root?: Document | Element): void;
  /** Render a preset offline; report measured peak/RMS. */
  probe(name: string, opts?: { volume?: number; pitchMul?: number }): Promise<ProbeResult>;
  /** Probe several presets and console.table the results. */
  probeAll(...names: string[]): Promise<ProbeResult[]>;
  /** Voice pool diagnostics + cap configuration. */
  voicePool: {
    setCap(name: string, cap: number): void;
    _stats(): Record<string, number>;
  };
  /** Current calibration factor map. */
  calibrationFactors(): Record<string, number>;
  /** Override a calibration factor (e.g. for sound design). */
  setCalibrationFactor(name: string, value: number): void;
  /** Live-reload — poll a stylesheet URL on an interval. */
  watch(url: string, intervalMs?: number): void;
  unwatch(url: string): void;
  /** Toggle auto-loudness calibration globally. */
  enableAutoLoudness(v?: boolean): void;
  isAutoLoudnessEnabled(): boolean;

  /** Direct master-level config swap without rebinding the cascade.
   *  Pass any subset of `{ room, "room-mix", "master-volume",
   *  "master-eq-low", "master-eq-high", quality }`. Unspecified keys
   *  reset to defaults. */
  setMasterConfig(decls: Partial<RuleDecls>): void;

  /** Re-fetch every `<link rel="audiostyle">` plus auto-loaded
   *  defaults.acs and rebind. Use after dynamically swapping a
   *  stylesheet's href (e.g. theme switching). */
  reload(): Promise<void>;

  /** Subscribe to every played sound (post-throttle). Returns an
   *  unsubscribe fn. */
  onTrigger(
    cb: (preset: string, decls: RuleDecls, source?: Element | null) => void
  ): () => void;

  /** Opt-in introspection overlay — fixed-position panel showing the
   *  last 20 triggers with preset / source / factor / mood / room. */
  devtools: {
    mount(): void;
    unmount(): void;
    toggle(): void;
  };

  /** Programmatic adapters for cases the declarative cascade can't
   *  express (async resolution, state-change notifications, hooks). */
  helpers: {
    play(name: string, opts?: Partial<RuleDecls>): void;
    attach(el: Element, name: string, event?: string): () => void;
    useSound(
      hooks: { useCallback: <T extends (...a: any[]) => any>(fn: T, deps: any[]) => T },
      name: string,
      opts?: Partial<RuleDecls>
    ): () => void;
  };
}

declare global {
  interface Window {
    ACS: ACSRuntime;
  }
}

export {};
