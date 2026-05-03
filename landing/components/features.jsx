/* global React, ACS */
const { useState: useStateF, useEffect: useEffectF } = React;

const FEATURES = [
  {
    title: "Familiar selectors",
    desc: "Tag, class, attribute, descendant, pseudo-state. Same cascade rules and specificity tiers you already know from CSS.",
    code: `dialog[open] button.primary:hover {\n  sound-on-click: confirm;\n}`,
    icon: "selector",
  },
  {
    title: "Inheritable properties",
    desc: "volume, pitch, pan, room, sound-mood inherit through DOM ancestry — set once on :root, refine where it matters.",
    code: `:root        { room: medium-room; }\ndialog[open] { room: small-room; }`,
    icon: "tree",
  },
  {
    title: "Auto-loudness",
    desc: "Every preset is K-weighted at startup; volume: 0.5 means the same perceptual level whether it's a tap or a gong.",
    code: `button { sound-on-click: bell; volume: 0.6; }\n/* same loudness as: */\nbutton { sound-on-click: tap; volume: 0.6; }`,
    icon: "level",
  },
  {
    title: "@sound at-rule",
    desc: "Define your own multi-layer voices. Modal IIR, additive tones, Karplus-Strong, FM, filtered noise — all in plain CSS-like syntax.",
    code: `@sound my-bell {\n  body { tones: 880hz; ratios: 1, 2.76, 5.4; }\n  ping { modal: 1800hz; decay: 200ms; }\n}`,
    icon: "layers",
  },
  {
    title: "Mood overlays",
    desc: "warm · bright · glassy · metallic · organic · punchy · retro · airy · lofi. Orthogonal filter chains over any preset.",
    code: `.retro-app { sound-mood: lofi; }\n.lab        { sound-mood: glassy; }`,
    icon: "mood",
  },
  {
    title: "Rooms & reverb",
    desc: "Six tuned spaces from intimate small-room to a Dattorro plate. Set per-element, inherits, mixable.",
    code: `:root      { room: chamber; }\n.modal     { room: plate; room-mix: 0.4; }`,
    icon: "room",
  },
  {
    title: "Hot reload",
    desc: "ACS.watch() polls the stylesheet and rebinds the cascade live. Edit and hear your sound change in <100 ms.",
    code: `ACS.watch('my-style.acs', 250);\n// edit, save, listen`,
    icon: "reload",
  },
  {
    title: "prefers-reduced-sound",
    desc: "Respects the (proposed) media query. Falls back gracefully when users opt out, just like prefers-reduced-motion.",
    code: `@media (prefers-reduced-sound: reduce) {\n  :root { master-volume: 0; }\n}`,
    icon: "ear",
  },
  {
    title: "var() — CSS-var bridge",
    desc: "Reference :root custom properties from any ACS value. Share design tokens between .css and .acs without duplicating them.",
    code: `:root      { --ui-loud: 0.7; }\nbutton     { volume: var(--ui-loud, 0.5); }\n.is-quiet  { volume: calc(var(--ui-loud) * 0.4); }`,
    icon: "bridge",
  },
  {
    title: "realtime — sub-1 ms latency",
    desc: "Single-mode modal/pluck or simple osc/noise layers can opt into the AudioWorklet voice processor. Fallback automatic when unsupported.",
    code: `@sound my-tap {\n  body { osc: sine; freq: 1200hz; decay: 25ms;\n         realtime: true; }\n}`,
    icon: "bolt",
  },
  {
    title: "quality knob",
    desc: "Global low/medium/high on :root caps voice pool, modal partial count, and reverb tail. One declaration, mobile-friendly.",
    code: `:root { quality: low; }\n/* 4-voice cap, 3 partials, 0.6× reverb */`,
    icon: "gauge",
  },
  {
    title: "sound-mood-mix",
    desc: "Wet/dry blend for sound-mood. Inherit a glassy mood subtree-wide, dial it back to 30% on a calmer card.",
    code: `body         { sound-mood: glassy; }\n.calm-card   { sound-mood-mix: 0.3; }`,
    icon: "blend",
  },
  {
    title: "@sample — external audio files",
    desc: "Register a URL under a name. Use it like any built-in preset; the buffer is fetched + cached on first trigger.",
    code: `@sample bonk url("sounds/bonk.wav");\n.bonk-btn { sound-on-click: bonk; }`,
    icon: "file",
  },
  {
    title: "Sound sequences",
    desc: "@sound-keyframes lays out a timeline; sound-sequence inlines one. Multi-step success feedback in three lines.",
    code: `@sound-keyframes save-ok {\n  0%   { sound: tap; }\n  60%  { sound: ding; }\n  100% { sound: success; }\n}\n.btn-save { sound: save-ok; sound-duration: 700ms; }`,
    icon: "timeline",
  },
  {
    title: "velocity-filter",
    desc: "Real-instrument feel — soft hits darken the timbre, loud hits brighten. One declaration, applied to any cascade subtree.",
    code: `.piano-key {\n  velocity-filter: on;\n  /* volume: 0.3 → 800 Hz LP; 1.0 → 8 kHz */\n}`,
    icon: "wave",
  },
];

function FeatureIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const map = {
    selector: <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10M7 12h6M7 17h8"/></svg>,
    tree:     <svg {...common}><circle cx="12" cy="4" r="1.5"/><circle cx="6" cy="14" r="1.5"/><circle cx="18" cy="14" r="1.5"/><circle cx="12" cy="20" r="1.5"/><path d="M12 5.5V12M12 12L6 13.5M12 12l6 1.5M6 15.5l6 3M18 15.5l-6 3"/></svg>,
    level:    <svg {...common}><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h-2"/></svg>,
    layers:   <svg {...common}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 14l9 5 9-5"/></svg>,
    mood:     <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
    room:     <svg {...common}><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/></svg>,
    reload:   <svg {...common}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>,
    ear:      <svg {...common}><path d="M6 8a6 6 0 1 1 12 0c0 3-2 4-3 5s-1 3-3 3-2-1-3-1-2-1-2-2 1-2 1-3-2-1-2-2z"/></svg>,
    bridge:   <svg {...common}><path d="M3 12h18"/><path d="M5 12V7m4 5V5m6 7V5m4 7V7"/><path d="M3 19h18"/></svg>,
    bolt:     <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    gauge:    <svg {...common}><path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-3"/></svg>,
    blend:    <svg {...common}><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>,
    file:     <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 14l2 2 4-4"/></svg>,
    timeline: <svg {...common}><path d="M3 12h18"/><circle cx="6" cy="12" r="2"/><circle cx="13" cy="12" r="2"/><circle cx="20" cy="12" r="2"/></svg>,
    wave:     <svg {...common}><path d="M2 12c2 0 2-6 4-6s2 12 4 12 2-12 4-12 2 12 4 12 2-6 4-6"/></svg>,
  };
  return map[kind] || null;
}

window.FeatureGrid = function FeatureGrid() {
  return (
    <section className="section" id="features">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Language</span>
          <h2 className="section-title">CSS muscle memory.<br/>Audio output.</h2>
          <p className="section-sub">Everything you'd expect from a stylesheet language — selectors, the cascade, at-rules, media queries, inheritance — applied to the audio layer of your interface.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <article key={i} className="feature">
              <div className="feature-head">
                <div className="feature-icon"><FeatureIcon kind={f.icon} /></div>
                <h3 className="feature-title">{f.title}</h3>
              </div>
              <p className="feature-desc">{f.desc}</p>
              <pre className="feature-code mono">{f.code}</pre>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
