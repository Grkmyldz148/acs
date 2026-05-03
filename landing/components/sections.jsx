/* global React, ACS */
const { useState: useStateT, useEffect: useEffectT } = React;

// ---------- How it works ----------
const STEPS = [
  {
    n: '01',
    title: 'Drop in the runtime',
    desc: 'Add one <link> and one <script>. The runtime auto-loads defaults.acs (49 presets) before any user stylesheet.',
    code: `<link rel="audiostyle" href="my-style.acs" />\n<script type="module" src="runtime.js"></script>`,
  },
  {
    n: '02',
    title: 'Write a stylesheet',
    desc: 'Selectors and the cascade target the audio layer. Properties like sound-on-click bind to DOM events.',
    code: `:root          { master-volume: 0.85; room: medium-room; }\nbutton         { sound-on-click: tap-tactile; }\nbutton.primary { sound-on-click: pop; }`,
  },
  {
    n: '03',
    title: 'Ship — your UI sounds tuned',
    desc: 'Auto-loudness keeps everything balanced. prefers-reduced-sound respects user choice. Hot-reload during dev.',
    code: `// optional: live-reload during dev\nACS.watch('my-style.acs', 250);`,
  },
];

window.HowItWorks = function HowItWorks() {
  return (
    <section className="section section-tight" id="how">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 className="section-title">From silent UI to tuned product in three steps.</h2>
        </div>
        <ol className="steps">
          {STEPS.map(s => (
            <li key={s.n} className="step">
              <div className="step-num mono">{s.n}</div>
              <div className="step-body">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
                <pre className="step-code mono">{s.code}</pre>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

// ---------- Themes ----------
const THEMES = [
  {
    id: 'apple',
    name: 'Apple',
    desc: 'Restrained, glassy, micro-tactile. Soft taps, plate reverb on dialogs.',
    accent: '210', // hue
    sounds: { click: 'tap-tactile', pop: 'pop', confirm: 'ding', open: 'modal-open' },
    swatch: ['#0071e3', '#f5f5f7', '#1d1d1f'],
  },
  {
    id: 'material',
    name: 'Material',
    desc: 'Warm, percussive, intentionally physical. Wood-block taps, organic mood.',
    accent: '30',
    sounds: { click: 'woodblock', pop: 'tap', confirm: 'success', open: 'drawer-open' },
    swatch: ['#6750a4', '#fffbfe', '#1c1b1f'],
  },
  {
    id: 'retro',
    name: 'Retro',
    desc: 'Lofi mood overlay, square-wave clicks, chiptune confirmation arpeggios.',
    accent: '320',
    sounds: { click: 'click', pop: 'tick', confirm: 'complete', open: 'page-enter' },
    swatch: ['#ff4775', '#fff8e7', '#202037'],
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    desc: 'No reverb. Loud thunks. Noise bursts. Designed to be felt, not blended in.',
    accent: '90',
    sounds: { click: 'thunk', pop: 'kick', confirm: 'badge', open: 'whoosh' },
    swatch: ['#cdff00', '#0a0a0a', '#ffffff'],
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    desc: 'Big airy hall, gong / page-transition energy. Made for trailers and key moments.',
    accent: '32',
    sounds: { click: 'swoosh', pop: 'modal-open', confirm: 'gong', open: 'page-enter' },
    swatch: ['#f59e0b', '#0c0a09', '#fafaf9'],
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    desc: 'Geometric primary forms. Sharp pings, no shimmer, no decoration.',
    accent: '0',
    sounds: { click: 'click', pop: 'ping', confirm: 'ding', open: 'modal-open' },
    swatch: ['#d62828', '#faf9f6', '#1a1a1a'],
  },
  {
    id: 'terminal',
    name: 'Terminal',
    desc: 'CRT, mechanical keyboard, paper feed. Lo-fi mood, woody clicks.',
    accent: '140',
    sounds: { click: 'woodblock', pop: 'tap-tactile', confirm: 'carriage-return', open: 'drawer-open' },
    swatch: ['#4ade80', '#0a0a0a', '#111111'],
  },
  {
    id: 'ambient',
    name: 'Ambient',
    desc: 'Soft, washy, generative. Bell-soft + chime-soft, warm mood at 70% mix.',
    accent: '270',
    sounds: { click: 'bell-soft', pop: 'chime-soft', confirm: 'success', open: 'sparkle' },
    swatch: ['#c4a8e8', '#f5f3ff', '#2e1065'],
  },
];

window.ThemePacks = function ThemePacks({ soundOn, requestSound }) {
  const play = (n) => { if (!soundOn) { requestSound(); return; } window.ACS.play(n); };
  return (
    <section className="section" id="themes">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Theme packs</span>
          <h2 className="section-title">Eight sonic identities, ready to drop in.</h2>
          <p className="section-sub">Stylesheets are portable. Swap an ACS file and the entire feel of your product changes — the same way swapping a CSS theme would.</p>
        </div>
        <div className="theme-grid">
          {THEMES.map(t => (
            <article key={t.id} className="theme">
              <div className="theme-head">
                <div className="theme-swatches">
                  {t.swatch.map((c, i) => (
                    <span key={i} className="theme-swatch" style={{background: c}}></span>
                  ))}
                </div>
                <div className="theme-name">{t.name}</div>
                <div className="theme-file mono">themes/{t.id}.acs</div>
              </div>
              <p className="theme-desc">{t.desc}</p>
              <div className="theme-bindings">
                {Object.entries(t.sounds).map(([k, v]) => (
                  <button key={k} className="theme-binding" onClick={() => play(v)}>
                    <span className="theme-binding-key mono">{k}</span>
                    <span className="theme-binding-arrow">→</span>
                    <span className="theme-binding-val mono">{v}</span>
                    <svg className="theme-binding-play" viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------- Install ----------
window.Install = function Install() {
  const [tab, setTab] = useStateT('npm');
  const snippets = {
    npm: `npm install acs-audio\n# or\npnpm add acs-audio`,
    cdn: `<link rel="audiostyle" href="my-style.acs" />\n<script type="module"\n        src="https://cdn.jsdelivr.net/npm/acs-audio/dist/runtime.mjs">\n</script>`,
    bun: `bun add acs-audio`,
  };
  return (
    <section className="section" id="install">
      <div className="wrap install-wrap">
        <div className="install-left">
          <span className="eyebrow">Install</span>
          <h2 className="section-title">~14kb of runtime,<br/>then write CSS.</h2>
          <p className="section-sub">Zero dependencies. Works in any modern browser with the Web Audio API. Renders silent on Safari until first interaction (per spec).</p>
          <ul className="install-checks">
            {/* Each li has exactly 2 flex children: <Check/> + a single
                content <span>. Without the wrapper, mixed text + code
                nodes each became their own flex item, which broke the
                layout on mobile (text and code chips landing in
                different columns of the same row). */}
            <li><Check/><span>Auto-loaded defaults.acs (49 presets, baked-leveled)</span></li>
            <li><Check/><span>Polyphony cap + oldest-fade voice stealing</span></li>
            <li><Check/><span>AudioWorklet voice processor — sub-1 ms <code className="mono">realtime</code> opt-in</span></li>
            <li><Check/><span>CSS-var bridge: <code className="mono">var(--token)</code> in any value</span></li>
            <li><Check/><span><code className="mono">window.ACS.devtools.mount()</code> — live trigger overlay</span></li>
            <li><Check/><span><code className="mono">window.ACS.helpers</code> — programmatic <code className="mono">play()</code> + React hook</span></li>
            <li><Check/><span>TypeScript types + VSCode extension w/ live linter</span></li>
          </ul>
        </div>
        <div className="install-right">
          <div className="window">
            <div className="window-bar">
              <div className="window-tabs">
                {['npm', 'cdn', 'bun'].map(k => (
                  <button key={k} className={`window-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{k}</button>
                ))}
              </div>
              <div className="window-actions">
                <button className="copy-btn mono" onClick={() => navigator.clipboard?.writeText(snippets[tab])}>copy</button>
              </div>
            </div>
            <pre className="code code-flush mono">{snippets[tab]}</pre>
          </div>
        </div>
      </div>
    </section>
  );
};

function Check() {
  return (
    <span className="check">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2.5,6 5,8.5 9.5,3.5"/>
      </svg>
    </span>
  );
}

// ---------- Roadmap ----------
const ROAD = [
  { phase: '0', title: 'Foundations', status: 'done', items: ['Parser, cascade, master chain', 'Modal / Karplus-Strong / FM / noise / tones', 'defaults.acs, analyzer, validation'] },
  { phase: '1', title: 'Auto-calibration', status: 'done', items: ['Offline pre-render, K-weighted RMS', 'Per-class budget + outlier overrides', 'Spread tightened to 4.8 dB'] },
  { phase: '4', title: 'DSP polish', status: 'done', items: ['TPT-SVF filters (Zavalishin)', 'Dattorro plate reverb', 'Voice pool / polyphony cap', 'AudioWorklet click processor'] },
  { phase: '6.7', title: 'Theme packs', status: 'done', items: ['8 themes: Apple · Material · Retro · Brutalist', 'Cinematic · Bauhaus · Terminal · Ambient'] },
  { phase: '7', title: 'Tooling', status: 'done', items: ['compile-acs, bundle, lint, audit', 'TypeScript types', 'VSCode extension + grammar + linter'] },
  { phase: '8.6', title: 'AudioWorklet voices', status: 'done', items: ['kind 0/1/2/3: sine, noise, modal, pluck', 'realtime: true opt-in for sub-1ms latency'] },
  { phase: '8.7', title: 'quality: knob', status: 'done', items: ['low / medium / high on :root', 'Caps voicepool, modal partials, reverb scale'] },
  { phase: '8.8', title: 'sound-mood-mix', status: 'done', items: ['Wet/dry blend 0..1 for sound-mood', 'Cached fast path when mix=1'] },
  { phase: '8.10', title: 'VSCode linter', status: 'done', items: ['Live DiagnosticCollection', 'Fuzzy-match hints for typos'] },
  { phase: '8.12', title: 'CSS-var bridge + devtools', status: 'done', items: ['var(--token) in any ACS value', 'window.ACS.devtools overlay'] },
  { phase: '9', title: 'Naming finalized', status: 'done', items: ['ACS — Audio Cascading Style Sheets', '@sample url() for external audio files', 'Framework helpers (play / attach / useSound)'] },
];

window.Roadmap = function Roadmap() {
  return (
    <section className="section" id="roadmap">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Roadmap</span>
          <h2 className="section-title">Where we are, where we're going.</h2>
        </div>
        <div className="roadmap">
          {ROAD.map((r, i) => (
            <div key={i} className={`road-row road-${r.status}`}>
              <div className="road-phase mono">phase {r.phase}</div>
              <div className="road-title">{r.title}</div>
              <ul className="road-items">
                {r.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
              <div className="road-status mono">
                {r.status === 'done' && <span className="status-done">● shipped</span>}
                {r.status === 'next' && <span className="status-next">● in progress</span>}
                {r.status === 'planned' && <span className="status-planned">○ planned</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="roadmap-hint mono">
          roadmap drained — watch GitHub for what lands next
        </p>
      </div>
    </section>
  );
};

// ---------- Footer ----------
window.Footer = function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-cols">
          <div>
            <div className="footer-brand" style={{marginBottom: 16}}>
              <ACSShield size={56} />
            </div>
            <p style={{maxWidth:280, margin:'0 0 16px', color:'var(--ink-3)'}}>Audio Cascading Style Sheets. Declarative sound for the web — same cascade, new layer.</p>
            <div style={{display:'flex', gap:10}}>
              <a className="icon-btn" href="https://github.com/Grkmyldz148/acs" title="GitHub" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 0 0-2.5 15.6c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.55 7.55 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg></a>
              <a className="icon-btn" href="https://www.npmjs.com/package/acs-audio" title="npm" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 4h16v8H8v1H4v-1H0V4zm1 7h2V6h2v5h1V5H1v6zm5-6v7h2v-1h2V5H6zm2 1h1v3H8V6zm3-1v6h2V6h1v5h1V6h1V5h-5z"/></svg></a>
            </div>
          </div>
          <div>
            <h4>Docs</h4>
            <ul>
              <li><a href="https://github.com/Grkmyldz148/acs#quick-start" target="_blank" rel="noopener">Quick start</a></li>
              <li><a href="https://github.com/Grkmyldz148/acs#examples" target="_blank" rel="noopener">Examples</a></li>
              <li><a href="#presets">Preset library</a></li>
              <li><a href="https://github.com/Grkmyldz148/acs/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Changelog</a></li>
              <li><a href="https://github.com/Grkmyldz148/acs/blob/main/types/acs.d.ts" target="_blank" rel="noopener">Runtime API</a></li>
            </ul>
          </div>
          <div>
            <h4>Tools</h4>
            <ul>
              <li><a href="https://github.com/Grkmyldz148/acs/releases" target="_blank" rel="noopener">VSCode extension (.vsix)</a></li>
              <li><a href="#components">Components gallery</a></li>
              <li><a href="acs-logo.svg" download>Brand mark (SVG)</a></li>
            </ul>
          </div>
          <div>
            <h4>Community</h4>
            <ul>
              <li><a href="https://github.com/Grkmyldz148/acs" target="_blank" rel="noopener">GitHub</a></li>
              <li><a href="https://github.com/Grkmyldz148/acs/issues" target="_blank" rel="noopener">Issues</a></li>
              <li><a href="#roadmap">Roadmap</a></li>
              <li><a href="https://github.com/Grkmyldz148/acs/discussions" target="_blank" rel="noopener">Discussions</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>MIT · v0.9 · {new Date().getFullYear()}</span>
          <span>Built with the Web Audio API</span>
        </div>
      </div>
    </footer>
  );
};
