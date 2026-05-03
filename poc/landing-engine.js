/* Tiny ACS-flavored audio engine for the landing page.
   Not the real runtime — just enough to make the demo feel alive. */
(function () {
  let ctx = null;
  let master = null;
  let convolver = null;
  let dry = null;
  let wet = null;
  let enabled = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.7;
    dry = ctx.createGain();
    wet = ctx.createGain();
    wet.gain.value = 0.18;
    convolver = ctx.createConvolver();
    convolver.buffer = makeIR(ctx, 1.6, 2.2);
    master.connect(ctx.destination);
    dry.connect(master);
    wet.connect(convolver).connect(master);
  }

  function makeIR(ctx, dur, decay) {
    const rate = ctx.sampleRate;
    const len = rate * dur;
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function route(g) {
    g.connect(dry);
    g.connect(wet);
  }

  // ---- Voice helpers ----
  function envGain(attack, decay, peak) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  function osc(type, freq, attack, decay, peak, filter) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = envGain(attack, decay, peak);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.cutoff;
      f.Q.value = filter.q || 0.7;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    route(g);
    o.start();
    o.stop(ctx.currentTime + attack + decay + 0.05);
  }

  function sweep(type, fStart, fEnd, dur, peak) {
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(fStart, t);
    o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    const g = envGain(0.002, dur, peak);
    o.connect(g);
    route(g);
    o.start();
    o.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, peak, filter) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    let node = src;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.cutoff;
      f.Q.value = filter.q || 0.7;
      src.connect(f);
      node = f;
    }
    const g = envGain(0.001, dur, peak);
    node.connect(g);
    route(g);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  function modal(fund, ratios, decays, gains, peak) {
    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fund * r;
      const g = envGain(0.001, decays[i] || 0.2, peak * (gains[i] || 0.5));
      o.connect(g);
      route(g);
      o.start();
      o.stop(ctx.currentTime + (decays[i] || 0.2) + 0.05);
    });
  }

  // ---- Presets ----
  const presets = {
    tap:        () => osc('sine', 880, 0.002, 0.04, 0.35, { type: 'lowpass', cutoff: 4000 }),
    'tap-tactile': () => { osc('sine', 1200, 0.001, 0.025, 0.3); noiseBurst(0.012, 0.15, { type: 'highpass', cutoff: 3000 }); },
    click:      () => noiseBurst(0.015, 0.4, { type: 'highpass', cutoff: 2500 }),
    'click-soft': () => noiseBurst(0.025, 0.22, { type: 'lowpass', cutoff: 3500 }),
    pop:        () => { sweep('sine', 600, 1100, 0.05, 0.32); },
    tick:       () => osc('triangle', 2200, 0.001, 0.02, 0.25, { type: 'bandpass', cutoff: 2200, q: 1.2 }),
    bell:       () => modal(880, [1, 2.76, 5.4], [0.6, 0.4, 0.25], [1, 0.5, 0.3], 0.18),
    'bell-soft':() => modal(660, [1, 2.4], [0.5, 0.3], [1, 0.4], 0.16),
    'bell-bright': () => modal(1320, [1, 2.76, 4.2, 5.4], [0.4, 0.3, 0.2, 0.18], [1, 0.6, 0.4, 0.3], 0.16),
    chime:      () => modal(1046, [1, 2, 3], [0.7, 0.5, 0.35], [1, 0.6, 0.4], 0.15),
    glass:      () => modal(1760, [1, 2.76, 5.4], [0.35, 0.22, 0.15], [1, 0.5, 0.3], 0.14),
    ting:       () => modal(2093, [1, 2.4], [0.25, 0.15], [1, 0.4], 0.16),
    gong:       () => modal(180, [1, 1.6, 2.4, 3.2], [1.6, 1.2, 0.8, 0.5], [1, 0.7, 0.5, 0.3], 0.18),
    kick:       () => sweep('sine', 140, 50, 0.18, 0.7),
    snare:      () => { osc('triangle', 220, 0.001, 0.08, 0.3); noiseBurst(0.12, 0.4, { type: 'highpass', cutoff: 1200 }); },
    hat:        () => noiseBurst(0.04, 0.25, { type: 'highpass', cutoff: 7000 }),
    clap:       () => noiseBurst(0.08, 0.35, { type: 'bandpass', cutoff: 1500, q: 0.8 }),
    thunk:      () => sweep('sine', 220, 110, 0.12, 0.5),
    woodblock:  () => modal(1200, [1, 2.4], [0.06, 0.04], [1, 0.5], 0.3),
    'pluck-soft': () => sweep('triangle', 440, 220, 0.4, 0.25),
    'pluck-bright': () => sweep('sawtooth', 880, 440, 0.35, 0.18),
    string:     () => modal(330, [1, 2, 3, 4], [0.9, 0.7, 0.5, 0.3], [1, 0.5, 0.3, 0.2], 0.14),
    success:    () => { osc('sine', 880, 0.005, 0.12, 0.3); setTimeout(() => osc('sine', 1318, 0.005, 0.18, 0.3), 80); },
    complete:   () => { osc('sine', 660, 0.005, 0.12, 0.28); setTimeout(() => osc('sine', 880, 0.005, 0.12, 0.28), 90); setTimeout(() => osc('sine', 1318, 0.005, 0.2, 0.3), 180); },
    confirm:    () => osc('sine', 1200, 0.005, 0.1, 0.28),
    error:      () => { sweep('sawtooth', 440, 180, 0.25, 0.22); },
    denied:     () => { osc('square', 220, 0.005, 0.08, 0.18); setTimeout(() => osc('square', 196, 0.005, 0.12, 0.18), 90); },
    prompt:     () => osc('sine', 880, 0.005, 0.15, 0.25),
    buzz:       () => osc('sawtooth', 110, 0.005, 0.18, 0.18, { type: 'lowpass', cutoff: 800 }),
    notify:     () => { modal(1318, [1, 2], [0.4, 0.25], [1, 0.5], 0.16); setTimeout(() => modal(1760, [1, 2], [0.4, 0.25], [1, 0.5], 0.16), 100); },
    ding:       () => modal(1760, [1, 2.4], [0.5, 0.3], [1, 0.4], 0.16),
    mention:    () => { modal(880, [1, 2.4], [0.3, 0.2], [1, 0.4], 0.16); setTimeout(() => modal(1318, [1, 2.4], [0.3, 0.2], [1, 0.4], 0.16), 70); },
    badge:      () => modal(1100, [1, 2.76], [0.35, 0.22], [1, 0.5], 0.16),
    'modal-open': () => sweep('sine', 220, 660, 0.18, 0.22),
    'modal-close': () => sweep('sine', 660, 220, 0.18, 0.22),
    'drawer-open': () => sweep('triangle', 200, 500, 0.22, 0.2),
    'drawer-close': () => sweep('triangle', 500, 200, 0.22, 0.2),
    'dropdown-open': () => sweep('sine', 440, 880, 0.1, 0.18),
    'dropdown-close': () => sweep('sine', 880, 440, 0.1, 0.18),
    'page-enter': () => sweep('sine', 110, 440, 0.35, 0.2),
    'page-exit': () => sweep('sine', 440, 110, 0.35, 0.2),
    'toggle-on': () => osc('sine', 1100, 0.003, 0.06, 0.28),
    'toggle-off': () => osc('sine', 700, 0.003, 0.06, 0.28),
    whoosh:     () => noiseBurst(0.35, 0.2, { type: 'bandpass', cutoff: 1200, q: 0.5 }),
    swoosh:     () => noiseBurst(0.4, 0.18, { type: 'bandpass', cutoff: 800, q: 0.4 }),
    sparkle:    () => { for (let i = 0; i < 4; i++) setTimeout(() => osc('sine', 1760 + i * 200, 0.002, 0.08, 0.12), i * 40); },
    ping:       () => modal(1318, [1, 2], [0.5, 0.3], [1, 0.4], 0.16),
    keystroke:  () => { const f = 1800 + Math.random() * 800; osc('sine', f, 0.001, 0.018, 0.18); noiseBurst(0.01, 0.08, { type: 'highpass', cutoff: 4000 }); },
    'carriage-return': () => { sweep('sine', 660, 220, 0.18, 0.22); setTimeout(() => noiseBurst(0.04, 0.15, { type: 'highpass', cutoff: 3000 }), 100); },
  };

  const ACS = {
    enable() {
      ensure();
      if (ctx.state === 'suspended') ctx.resume();
      enabled = true;
    },
    disable() { enabled = false; },
    isEnabled() { return enabled; },
    play(name) {
      if (!enabled) return;
      ensure();
      const fn = presets[name];
      if (fn) try { fn(); } catch (e) { console.warn('ACS play error', name, e); }
    },
    setMaster(v) { if (master) master.gain.value = v; },
    setRoom(amount) { if (wet) wet.gain.value = amount; },
    setReverbSize(seconds) {
      if (!ctx) ensure();
      convolver.buffer = makeIR(ctx, seconds, 2.2);
    },
    presets: () => Object.keys(presets),
  };

  window.LandingACS = ACS;
})();
