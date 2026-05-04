/* click-processor.js — AudioWorklet voice processor for ultra-low-latency
 * UI sounds.
 *
 * Loaded via:
 *   ctx.audioWorklet.addModule('runtime/worklets/click-processor.js')
 *
 * Then triggered via:
 *   const node = new AudioWorkletNode(ctx, 'acs-click', {
 *     parameterData: { freq: 2000, decay: 0.04, gain: 0.5, kind: 0 }
 *   });
 *   node.connect(dest);
 *
 * `kind` selects synthesis type:
 *   0 = sine tap            — pure sine + exp decay
 *   1 = filtered noise click — white noise → 1-pole LP at `freq`
 *   2 = modal tap            — single-mode IIR resonator at `freq`,
 *                              t60 = `decay`. Mirrors playModalLayer's
 *                              single-partial path so an opt-in worklet
 *                              voice sounds the same as the main-thread
 *                              equivalent.
 *   3 = pluck (Karplus-Strong) — delay line of length sr/freq, lowpass
 *                              feedback. `extra` ∈ [0,1] = brightness.
 *
 * This bypasses main-thread → AudioContext.currentTime scheduling,
 * giving sub-millisecond latency from JS trigger to audible output.
 * Suitable for keystroke ticks and click feedback where perceived
 * responsiveness matters more than DSP variety.
 */

class ACSClickProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "freq",  defaultValue: 2000, minValue: 20, maxValue: 20000 },
      { name: "decay", defaultValue: 0.04, minValue: 0.001, maxValue: 4 },
      { name: "gain",  defaultValue: 0.5,  minValue: 0, maxValue: 2 },
      // 0 = sine, 1 = noise click, 2 = modal tap, 3 = pluck (KS)
      { name: "kind",  defaultValue: 0, minValue: 0, maxValue: 3 },
      // Auxiliary param — interpretation depends on `kind`:
      //   kind 3 (pluck) → brightness (0..1, KS damping)
      //   else           → unused
      { name: "extra", defaultValue: 0.6, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this._t = 0;
    this._phase = 0;
    this._done = false;
    // Filter state for noise mode (1-pole LP).
    this._lpfState = 0;
    // Modal IIR (kind=2) state — direct form I, b=[1,0,-1], a=[1,a1,a2].
    this._mxz1 = 0;
    this._mxz2 = 0;
    this._myz1 = 0;
    this._myz2 = 0;
    // PRNG for noise sources.
    this._noiseSeed = (Math.random() * 0x7fffffff) | 0;
    // Karplus-Strong state — initialized lazily on first process() so we
    // can size the delay buffer from `freq` after AudioParam resolution.
    this._ksBuf = null;
    this._ksIdx = 0;
    this._ksLen = 0;
    this._ksPrev = 0;
  }

  _prng() {
    let s = this._noiseSeed | 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    this._noiseSeed = s;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }

  _initKS(freq) {
    const len = Math.max(2, Math.floor(sampleRate / Math.max(20, freq)));
    const buf = new Float32Array(len);
    // Excite with white noise — classic KS pluck.
    for (let i = 0; i < len; i++) buf[i] = this._prng();
    this._ksBuf = buf;
    this._ksLen = len;
    this._ksIdx = 0;
    this._ksPrev = 0;
  }

  _initModal(freq, t60) {
    // Biquad resonator: y = b0*x + b1*x[-1] + b2*x[-2] - a1*y[-1] - a2*y[-2]
    // Same coefficients as main-thread playModalLayer single-partial path:
    //   b = [1, 0, -1] (differentiator, gives the "ping" character)
    //   a1 = -2*r*cos(w), a2 = r²
    // Use direct form II transposed for stability.
    const w = (2 * Math.PI * freq) / sampleRate;
    const r = Math.pow(0.001, 1 / Math.max(1, t60 * sampleRate));
    this._mA1 = -2 * r * Math.cos(w);
    this._mA2 = r * r;
    // Numerator gain compensation matching main-thread path so high and
    // low frequencies hit similar amplitude.
    this._mNumComp = 1 / Math.max(0.05, 2 * Math.sin(w));
    // Excitation: brief noise burst at trigger time.
    this._mExciteSamples = Math.max(1, Math.floor(0.003 * sampleRate));
  }

  process(_inputs, outputs, params) {
    if (this._done) return false; // node will be GC'd
    const out = outputs[0];
    const ch = out[0];
    if (!ch) return true;
    const sr = sampleRate;
    const decay = params.decay[0];
    const gain = params.gain[0];
    const kind = params.kind[0] | 0;
    const freq = params.freq[0];
    const extra = params.extra[0];

    if (kind === 3 && !this._ksBuf) this._initKS(freq);
    if (kind === 2 && this._mA1 === undefined) this._initModal(freq, decay);

    const lpfA = Math.exp(-2 * Math.PI * freq / sr); // 1-pole around freq

    for (let i = 0; i < ch.length; i++) {
      if (this._t >= decay) {
        ch[i] = 0;
        continue;
      }
      let s;
      if (kind === 0) {
        // Sine tap.
        const env = Math.exp(-this._t / (decay * 0.3));
        s = Math.sin(this._phase) * env * gain;
        this._phase += 2 * Math.PI * freq / sr;
        if (this._phase > 2 * Math.PI) this._phase -= 2 * Math.PI;
      } else if (kind === 1) {
        // Filtered noise click.
        const env = Math.exp(-this._t / (decay * 0.3));
        const n = this._prng();
        this._lpfState = lpfA * this._lpfState + (1 - lpfA) * n;
        s = this._lpfState * env * gain * 2;
      } else if (kind === 2) {
        // Modal tap. Brief noise excitation feeds a biquad resonator with
        // numerator b=[1,0,-1], poles from a1/a2. Direct form I.
        const sampleIdx = (this._t * sr) | 0;
        const x = sampleIdx < this._mExciteSamples
          ? this._prng() * (1 - sampleIdx / this._mExciteSamples)
          : 0;
        // y[n] = x[n] - x[n-2] - a1*y[n-1] - a2*y[n-2]
        const yNew = x - this._mxz2 - this._mA1 * this._myz1 - this._mA2 * this._myz2;
        s = yNew * gain * this._mNumComp * 0.6;
        this._mxz2 = this._mxz1; this._mxz1 = x;
        this._myz2 = this._myz1; this._myz1 = yNew;
      } else {
        // Pluck (Karplus-Strong). Damping derived from `extra` (brightness).
        const damp = 0.5 + extra * 0.45;
        // Decay multiplier per sample so the line bleeds energy at the
        // requested t60 (tighter than infinite KS sustain).
        const roundTrips = Math.max(1, decay * freq);
        const r = Math.pow(0.001, 1 / Math.max(1, roundTrips * this._ksLen));
        const idx = this._ksIdx;
        const cur = this._ksBuf[idx];
        s = cur * gain;
        const next = (cur * damp + this._ksPrev * (1 - damp)) * r;
        this._ksBuf[idx] = next;
        this._ksPrev = cur;
        this._ksIdx = (idx + 1) % this._ksLen;
      }
      ch[i] = s;
      this._t += 1 / sr;
    }
    if (this._t >= decay) this._done = true;
    return true;
  }
}

registerProcessor("acs-click", ACSClickProcessor);
