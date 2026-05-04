/* global React, ReactDOM, Nav, Hero, ACSShield, ComponentsGallery, FeatureGrid, PresetGallery, BeforeAfter, RealWorld, HowItWorks, ThemePacks, Install, Roadmap, Footer, useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakToggle, TweakRadio, TweakSelect */

const { useState: useStateApp, useEffect: useEffectApp, useCallback: useCallbackApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 165,
  "density": 1.0,
  "fontPairing": "geist",
  "audioReactive": true,
  "reverbAmount": 0.18
}/*EDITMODE-END*/;

const FONT_PAIRINGS = {
  geist:    { sans: '"Geist", system-ui, sans-serif',     mono: '"JetBrains Mono", ui-monospace, monospace' },
  inter:    { sans: '"Inter", system-ui, sans-serif',     mono: '"IBM Plex Mono", ui-monospace, monospace' },
  serif:    { sans: '"Instrument Serif", Georgia, serif', mono: '"JetBrains Mono", ui-monospace, monospace' },
  allmono:  { sans: '"JetBrains Mono", ui-monospace, monospace', mono: '"JetBrains Mono", ui-monospace, monospace' },
};

function App() {
  const [theme, setTheme] = useStateApp(() => {
    const saved = localStorage.getItem('acs.theme');
    if (saved) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  // Default ON — the shim already sets the runtime to enabled and arms
  // a one-shot gesture listener that resumes the AudioContext on the
  // user's first click. The toggle in the nav stays as a visible mute.
  const [soundOn, setSoundOn] = useStateApp(true);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffectApp(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('acs.theme', theme);
  }, [theme]);

  // Apply tweaks to CSS vars
  useEffectApp(() => {
    const r = document.documentElement.style;
    r.setProperty('--accent-h', tweaks.accentHue);
    r.setProperty('--density', tweaks.density);
    const fp = FONT_PAIRINGS[tweaks.fontPairing] || FONT_PAIRINGS.geist;
    r.setProperty('--font-sans', fp.sans);
    r.setProperty('--font-mono', fp.mono);
    if (window.ACS && window.ACS.setRoom) window.ACS.setRoom(tweaks.reverbAmount);
  }, [tweaks]);

  const enableSound = useCallbackApp(() => {
    window.ACS.enable();
    setSoundOn(true);
    setTimeout(() => window.ACS.play('chime'), 100);
  }, []);

  const toggleSound = useCallbackApp(() => {
    if (soundOn) { window.ACS.disable(); setSoundOn(false); }
    else { enableSound(); }
  }, [soundOn, enableSound]);

  // Auto-play sound on hover for tryouts/buttons when audioReactive is on
  useEffectApp(() => {
    if (!soundOn || !tweaks.audioReactive) return;
    const handler = (e) => {
      const el = e.target.closest('[data-hover-sound]');
      if (el) window.ACS.play(el.getAttribute('data-hover-sound'));
    };
    document.addEventListener('mouseover', handler);
    return () => document.removeEventListener('mouseover', handler);
  }, [soundOn, tweaks.audioReactive]);

  // When the home page is reached via /#components etc. the browser tries
  // to scroll to the hash *before* React mounts the components — so it
  // ends up at top: 0. Once we've rendered, find the hash target and
  // scroll to it manually with the fixed-header offset baked in.
  useEffectApp(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    // Two rAF ticks lets components-gallery / features render before we
    // measure offsetTop — first tick the React tree commits, second tick
    // the layout settles.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(id);
        if (!target) return;
        const headerHeight = 56;
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }, []);

  // Global toast — sliding pill at bottom-center, fired by anything in
  // the app via window.acsToast(message). Used by Install, Hero copy
  // cards, components-gallery, etc. so each component doesn't have to
  // ship its own toast UI.
  const [toast, setToast] = useStateApp({ msg: '', show: false });
  useEffectApp(() => {
    let timer = null;
    window.acsToast = (msg) => {
      setToast({ msg, show: true });
      clearTimeout(timer);
      timer = setTimeout(() => setToast((t) => ({ ...t, show: false })), 2200);
    };
    return () => { delete window.acsToast; clearTimeout(timer); };
  }, []);

  return (
    <>
      <Nav theme={theme} setTheme={setTheme} soundOn={soundOn} onToggleSound={toggleSound} />
      <main>
        <Hero soundOn={soundOn} requestSound={enableSound} />
        <ComponentsGallery soundOn={soundOn} requestSound={enableSound} />
        <FeatureGrid />
        <BeforeAfter soundOn={soundOn} requestSound={enableSound} />
        <PresetGallery soundOn={soundOn} requestSound={enableSound} />
        <RealWorld soundOn={soundOn} requestSound={enableSound} />
        <HowItWorks />
        <ThemePacks soundOn={soundOn} requestSound={enableSound} />
        <Install />
        <Roadmap />
      </main>
      <Footer />

      <div className={`acs-global-toast ${toast.show ? 'show' : ''}`} role="status" aria-live="polite">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 8.5L6 11.5L13 4.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>{toast.msg}</span>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Accent">
          <TweakSlider label="Hue" value={tweaks.accentHue} min={0} max={360} step={1} onChange={(v) => setTweak('accentHue', v)} suffix="°" />
        </TweakSection>
        <TweakSection title="Layout">
          <TweakSlider label="Density" value={tweaks.density} min={0.6} max={1.4} step={0.05} onChange={(v) => setTweak('density', v)} />
          <TweakSelect label="Type pairing" value={tweaks.fontPairing} options={[
            { value: 'geist', label: 'Geist + JetBrains Mono' },
            { value: 'inter', label: 'Inter + IBM Plex' },
            { value: 'serif', label: 'Instrument Serif + Mono' },
            { value: 'allmono', label: 'All JetBrains Mono' },
          ]} onChange={(v) => setTweak('fontPairing', v)} />
        </TweakSection>
        <TweakSection title="Audio">
          <TweakToggle label="Hover sounds" value={tweaks.audioReactive} onChange={(v) => setTweak('audioReactive', v)} />
          <TweakSlider label="Room mix" value={tweaks.reverbAmount} min={0} max={0.6} step={0.02} onChange={(v) => setTweak('reverbAmount', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
