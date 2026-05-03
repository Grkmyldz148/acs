/* global React, ACS */
const { useState: useStateBA, useRef: useRefBA } = React;

/* ---------- Before / After ---------- */
const FLOW = [
  { delay: 0,    label: "User clicks 'Send'",        sound: 'tap-tactile', target: 'send' },
  { delay: 350,  label: "Network request fires",     sound: null,          target: null },
  { delay: 800,  label: "Validation succeeds",       sound: 'success',     target: 'check' },
  { delay: 1400, label: "Toast notification appears",sound: 'notify',      target: 'toast' },
  { delay: 2200, label: "Toast dismissed",           sound: 'modal-close', target: 'toast-close' },
];

window.BeforeAfter = function BeforeAfter({ soundOn, requestSound }) {
  const [playing, setPlaying] = useStateBA(null); // 'silent' | 'tuned' | null
  const [step, setStep] = useStateBA(-1);
  const [toastVisible, setToastVisible] = useStateBA(false);
  const [checkVisible, setCheckVisible] = useStateBA(false);
  const timersRef = useRefBA([]);

  const reset = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setStep(-1);
    setToastVisible(false);
    setCheckVisible(false);
  };

  const play = (mode) => {
    reset();
    if (mode === 'tuned' && !soundOn) { requestSound(); return; }
    setPlaying(mode);
    FLOW.forEach((s, i) => {
      const t = setTimeout(() => {
        setStep(i);
        if (s.target === 'check') setCheckVisible(true);
        if (s.target === 'toast') setToastVisible(true);
        if (s.target === 'toast-close') setToastVisible(false);
        if (mode === 'tuned' && s.sound && soundOn) window.ACS.play(s.sound);
      }, s.delay);
      timersRef.current.push(t);
    });
    const tEnd = setTimeout(() => {
      setPlaying(null);
      setStep(-1);
    }, 3000);
    timersRef.current.push(tEnd);
  };

  return (
    <section className="section" id="compare">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Before & after</span>
          <h2 className="section-title">Same flow.<br/>One has feedback. One doesn't.</h2>
          <p className="section-sub">Press play on each. The visuals are identical — the right one just knows when to make a sound. That's what a 12-line stylesheet buys you.</p>
        </div>

        <div className="compare-grid">
          {[
            { id: 'silent', title: 'Without ACS', sub: 'Functional. But mute.', tone: 'silent' },
            { id: 'tuned',  title: 'With ACS',    sub: 'Same UI, declared sound layer.', tone: 'tuned' },
          ].map(card => {
            // Gate the visual progression by card identity. Earlier the
            // shared step / toastVisible / checkVisible state was reflected
            // by BOTH cards — clicking play on the silent card visually
            // animated the tuned card too, which read as "audio is leaking
            // across" even though only the silent card was the active one.
            const isActive = playing === card.id;
            const cardStep = isActive ? step : -1;
            const cardCheck = isActive ? checkVisible : false;
            const cardToast = isActive ? toastVisible : false;
            return (
              <article key={card.id} className={`compare ${card.tone} ${isActive ? 'is-playing' : ''}`}>
                <header className="compare-head">
                  <div>
                    <h3 className="compare-title">{card.title}</h3>
                    <p className="compare-sub">{card.sub}</p>
                  </div>
                  <button className="btn btn-ghost compare-play" onClick={() => play(card.id)} disabled={playing && !isActive}>
                    <svg viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>
                    {isActive ? 'playing…' : 'play flow'}
                  </button>
                </header>

                <div className="compare-stage">
                  <div className="compose-bar">
                    <div className="compose-input mono" style={{color: 'var(--ink-3)'}}>Hey — meeting on Tuesday?</div>
                    <button className={`compose-send ${cardStep >= 0 ? 'pressed' : ''}`}>
                      {cardCheck ? (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,8 7,12 13,4"/></svg>
                      ) : 'Send'}
                    </button>
                  </div>
                  {cardToast && (
                    <div className="compose-toast">
                      <span className="compose-toast-dot"></span>
                      <span>Message sent · delivered</span>
                    </div>
                  )}
                </div>

                <ol className="compare-timeline">
                  {FLOW.map((f, i) => (
                    <li key={i} className={`tl-step ${cardStep >= i ? 'on' : ''} ${cardStep === i ? 'now' : ''}`}>
                      <span className="tl-dot"></span>
                      <span className="tl-label">{f.label}</span>
                      {card.id === 'tuned' && f.sound && (
                        <span className="tl-sound mono">{f.sound}</span>
                      )}
                      {card.id === 'silent' && f.sound && (
                        <span className="tl-sound mono tl-mute">— silent —</span>
                      )}
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
