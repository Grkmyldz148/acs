/* global React, ACS, CodeBlock */
const { useState: useStateHero, useEffect: useEffectHero, useRef: useRefHero } = React;

// Animated waveform under hero — runs at the display's full refresh rate
// (typically 60 / 120 Hz). Pauses entirely when off-screen via
// IntersectionObserver, and palette colors are cached + observed for
// theme changes so getComputedStyle isn't called per frame (that was
// triggering layout flushes — the previous FPS hot spot).
//
// The cached canvas dimensions + pre-computed amplitude bounds keep the
// inner loop allocation-free; bars are drawn with a single fillRect per.
function Waveform({ active }) {
  const ref = useRefHero(null);
  useEffectHero(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let raf;
    let t = 0;
    let visible = true;
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      const r = c.getBoundingClientRect();
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Cache palette — re-read on theme toggle (data-theme attr changes).
    let accent = '', ink3 = '';
    function readPalette() {
      const cs = getComputedStyle(document.documentElement);
      accent = cs.getPropertyValue('--accent').trim();
      ink3 = cs.getPropertyValue('--ink-3').trim();
    }
    readPalette();
    const themeObs = new MutationObserver(readPalette);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Pause when off-screen — hero scrolls out fast, no point burning frames.
    const visObs = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) tick();
      },
      { threshold: 0 }
    );
    visObs.observe(c);

    function tick() {
      if (!visible) { raf = null; return; }
      raf = requestAnimationFrame(tick);
      const r = c.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      const cy = r.height / 2;
      const bars = Math.floor(r.width / 4);
      const amp0 = r.height * 0.42;
      const amp1 = r.height * 0.18;
      ctx.globalAlpha = active ? 0.7 : 0.25;
      for (let i = 0; i < bars; i++) {
        const x = i * 4 + 1;
        const phase = i * 0.18 + t * 0.05;
        const amp = active
          ? (Math.sin(phase) * 0.5 + Math.sin(phase * 2.3) * 0.3 + Math.sin(phase * 0.7) * 0.2) * amp0
          : (Math.sin(phase) * 0.18) * amp1;
        ctx.fillStyle = (i % 9 === 0 && active) ? accent : ink3;
        ctx.fillRect(x, cy - Math.abs(amp), 2, Math.abs(amp) * 2);
      }
      t += 1;
    }
    tick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      visObs.disconnect();
      themeObs.disconnect();
    };
  }, [active]);
  return <canvas ref={ref} className="hero-waveform" />;
}

// ACS shield — pentagon badge using the exact CSS3 / HTML5 shield
// geometry (identical viewBox + outer path + inner right-half highlight).
// Two-tone wordmark via clipPaths: left half muted, right half pure
// foreground — same "engraved" visual the CSS3 / HTML5 badges use.
//
// Each rendered instance gets its own clip-path IDs so multiple shields
// on the same page don't collide.
let _acsShieldCounter = 0;
function ACSShield({ size = 120 }) {
  const idRef = useRefHero(null);
  if (idRef.current === null) idRef.current = ++_acsShieldCounter;
  const lid = `acs-half-l-${idRef.current}`;
  const rid = `acs-half-r-${idRef.current}`;
  return (
    <svg className="acs-shield"
         viewBox="0 0 512 512"
         width={size} height={size}
         aria-label="ACS logo">
      <path className="acs-shield-outer"
            d="M71.357 460.819L30.272 0h451.456l-41.129 460.746L255.724 512z" />
      <path className="acs-shield-inner"
            d="M405.388 431.408l35.148-393.73H256v435.146z" />
      <defs>
        <clipPath id={lid}><rect x="0"   y="0" width="256" height="512" /></clipPath>
        <clipPath id={rid}><rect x="256" y="0" width="256" height="512" /></clipPath>
      </defs>
      <g fontFamily="Geist, Inter, ui-sans-serif, system-ui, sans-serif"
         fontWeight="600" fontSize="46" letterSpacing="3">
        <text x="60" y="170" className="acs-shield-tag-l" clipPath={`url(#${lid})`}>audio</text>
        <text x="60" y="170" className="acs-shield-tag-r" clipPath={`url(#${rid})`}>audio</text>
      </g>
      <g fontFamily="Geist, Inter, ui-sans-serif, system-ui, sans-serif"
         fontWeight="900" fontSize="200" letterSpacing="-9">
        <text x="60" y="410" className="acs-shield-mark-l" clipPath={`url(#${lid})`}>ACS</text>
        <text x="60" y="410" className="acs-shield-mark-r" clipPath={`url(#${rid})`}>ACS</text>
      </g>
    </svg>
  );
}
window.ACSShield = ACSShield;

const HERO_CODE = `:root            { master-volume: 0.85; room: medium-room; }

button           { sound-on-click: tap-tactile; }
button.primary   { sound-on-click: pop; }
button.danger    { sound-on-click: error; }
input:on-input   { sound: keystroke; }
dialog[open]     { room: small-room; }

@media (prefers-reduced-sound: reduce) {
  :root { master-volume: 0; }
}`;

window.Hero = function Hero({ soundOn, requestSound }) {
  const play = (name) => {
    if (!soundOn) { requestSound(); return; }
    window.ACS.play(name);
  };
  return (
    <section className="hero" id="top">
      <div className="hero-grid-bg" aria-hidden="true"></div>
      <Waveform active={soundOn} />
      <div className="wrap hero-inner">
        <div className="hero-left">
          <div className="hero-eyebrow hero-eyebrow-row">
            <ACSShield size={64} />
            <span className="chip">
              <span className="chip-dot"></span>
              <span>v0.9 · CSS-var bridge + worklet voice</span>
            </span>
          </div>
          <h1 className="hero-title">
            Cascading Style Sheets,<br/>
            <span className="hero-title-accent">but for sound.</span>
          </h1>
          <p className="hero-sub">
            ACS is a declarative stylesheet language for audio.
            Same selectors, same cascade — properties target <code className="mono">sound</code>, <code className="mono">volume</code>, <code className="mono">pitch</code>, <code className="mono">room</code>.
            One <code className="mono">&lt;link&gt;</code> tag and your buttons sound like buttons.
          </p>
          <div className="hero-cta">
            <a href="#install" className="btn btn-accent">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Install in 30 seconds
            </a>
            <a href="#presets" className="btn btn-ghost">Browse 49 presets</a>
          </div>
          <div className="hero-meta">
            <span className="hero-meta-item">
              <kbd className="kbd">npm i acs</kbd>
            </span>
            <span className="hero-meta-dot"></span>
            <span className="hero-meta-item mono">~14kb gzipped</span>
            <span className="hero-meta-dot"></span>
            <span className="hero-meta-item mono">zero deps</span>
            <span className="hero-meta-dot"></span>
            <span className="hero-meta-item mono">MIT</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="window">
            <div className="window-bar">
              <div className="window-dots">
                <span></span><span></span><span></span>
              </div>
              <div className="window-title mono">my-style.acs</div>
              <div className="window-actions">
                <span className="window-tag mono">acs</span>
              </div>
            </div>
            <CodeBlock className="code-flush">{HERO_CODE}</CodeBlock>
            <div className="window-foot">
              <span className="mono" style={{color:'var(--ink-3)'}}>// try it →</span>
              <div className="hero-tryouts">
                <button className="tryout" onClick={() => play('tap-tactile')}>tap-tactile</button>
                <button className="tryout primary" onClick={() => play('pop')}>pop</button>
                <button className="tryout danger" onClick={() => play('error')}>error</button>
                <button className="tryout" onClick={() => play('keystroke')}>keystroke</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!soundOn && (
        <button className="hero-soundnudge" onClick={requestSound}>
          <span className="hero-soundnudge-pulse"></span>
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 5L9 2v12L5 11H2V5h3z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg>
          <span>Enable sound to experience the demos</span>
        </button>
      )}
    </section>
  );
};
