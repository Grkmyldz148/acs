/* global React, ACS */
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

const PRESETS = [
  { name: 'click',         cat: 'Click',     desc: 'Crisp filtered noise burst' },
  { name: 'click-soft',    cat: 'Click',     desc: 'Muted, low-pass noise' },
  { name: 'tap',           cat: 'Click',     desc: 'Pure 880hz sine pop' },
  { name: 'tap-tactile',   cat: 'Click',     desc: 'Sine + high noise — feels physical' },
  { name: 'tick',          cat: 'Click',     desc: 'Bandpass triangle, mech-keyboard energy' },
  { name: 'pop',           cat: 'Click',     desc: 'Upward sine sweep' },

  { name: 'bell',          cat: 'Bell',      desc: 'Modal IIR — 1 · 2.76 · 5.4 partials' },
  { name: 'bell-soft',     cat: 'Bell',      desc: 'Two-partial, mellow' },
  { name: 'bell-bright',   cat: 'Bell',      desc: 'Four partials, glassy top' },
  { name: 'chime',         cat: 'Bell',      desc: 'Octave + fifth, doorbell-y' },
  { name: 'chime-soft',    cat: 'Bell',      desc: 'Mellow chime — gentler attack' },
  { name: 'glass',         cat: 'Bell',      desc: 'Short modal, tuned bowl' },
  { name: 'ting',          cat: 'Bell',      desc: '2.1 kHz fundamental, snappy' },
  { name: 'gong',          cat: 'Bell',      desc: 'Sub-180 Hz with long tail' },

  { name: 'kick',          cat: 'Perc',      desc: 'Sub-sine pitch sweep' },
  { name: 'snare',         cat: 'Perc',      desc: 'Triangle body + filtered noise' },
  { name: 'hat',           cat: 'Perc',      desc: '7 kHz noise burst' },
  { name: 'clap',          cat: 'Perc',      desc: 'Bandpassed mid-noise' },
  { name: 'thunk',         cat: 'Perc',      desc: 'Low sine downward sweep' },
  { name: 'woodblock',     cat: 'Perc',      desc: 'Modal click, very short' },

  { name: 'pluck-soft',    cat: 'String',    desc: 'Triangle decay sweep' },
  { name: 'pluck-bright',  cat: 'String',    desc: 'Saw decay sweep' },
  { name: 'string',        cat: 'String',    desc: '4-partial modal sustain' },

  { name: 'success',       cat: 'Feedback',  desc: 'Two-note rising sine' },
  { name: 'complete',      cat: 'Feedback',  desc: 'Three-note arpeggio' },
  { name: 'confirm',       cat: 'Feedback',  desc: 'Single high-sine ping' },
  { name: 'error',         cat: 'Feedback',  desc: 'Saw downward sweep' },
  { name: 'denied',        cat: 'Feedback',  desc: 'Two-note descending square' },
  { name: 'prompt',        cat: 'Feedback',  desc: 'Sustained sine attention' },
  { name: 'buzz',          cat: 'Feedback',  desc: 'Lowpassed saw growl' },

  { name: 'notify',        cat: 'Notify',    desc: 'Two-note modal ascend' },
  { name: 'ding',          cat: 'Notify',    desc: 'Single bright modal' },
  { name: 'mention',       cat: 'Notify',    desc: 'Two-modal up' },
  { name: 'badge',         cat: 'Notify',    desc: 'Inharmonic clang' },

  { name: 'modal-open',    cat: 'Transition',desc: 'Sine sweep up' },
  { name: 'modal-close',   cat: 'Transition',desc: 'Sine sweep down' },
  { name: 'drawer-open',   cat: 'Transition',desc: 'Triangle sweep up' },
  { name: 'drawer-close',  cat: 'Transition',desc: 'Triangle sweep down' },
  { name: 'dropdown-open', cat: 'Transition',desc: 'Brighter dropdown chirp up' },
  { name: 'dropdown-close',cat: 'Transition',desc: 'Brighter dropdown chirp down' },
  { name: 'page-enter',    cat: 'Transition',desc: 'Long sine ascend' },
  { name: 'page-exit',     cat: 'Transition',desc: 'Long sine descend' },

  { name: 'toggle-on',     cat: 'Toggle',    desc: 'High sine click' },
  { name: 'toggle-off',    cat: 'Toggle',    desc: 'Low sine click' },

  { name: 'whoosh',        cat: 'Texture',   desc: 'Bandpass noise mid' },
  { name: 'swoosh',        cat: 'Texture',   desc: 'Bandpass noise low' },
  { name: 'sparkle',       cat: 'Texture',   desc: 'Cascading high sines' },
  { name: 'ping',          cat: 'Texture',   desc: 'Modal high ping' },

  { name: 'keystroke',     cat: 'Procedural',desc: 'Randomized typing tick' },
  { name: 'carriage-return',cat:'Procedural',desc: 'Sweep + paper noise' },
  { name: 'old-bell',      cat: 'Procedural',desc: 'Aged bell — detuned partials' },
];

const CATS = ['All', 'Click', 'Bell', 'Perc', 'String', 'Feedback', 'Notify', 'Transition', 'Toggle', 'Texture', 'Procedural'];

window.PresetGallery = function PresetGallery({ soundOn, requestSound }) {
  const [cat, setCat] = useStateP('All');
  const [last, setLast] = useStateP(null);

  const items = cat === 'All' ? PRESETS : PRESETS.filter(p => p.cat === cat);

  const play = (name) => {
    if (!soundOn) { requestSound(); return; }
    setLast(name);
    window.ACS.play(name);
    setTimeout(() => setLast(prev => prev === name ? null : prev), 600);
  };

  return (
    <section className="section" id="presets">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Library</span>
          <h2 className="section-title">All {PRESETS.length} presets, auditionable.</h2>
          <p className="section-sub">Every built-in voice is a click away. Browse by family, or override any of them with your own <code className="mono">@sound</code> declaration.</p>
        </div>

        <div className="cat-tabs">
          {CATS.map(c => (
            <button
              key={c}
              className={`cat-tab ${cat === c ? 'on' : ''}`}
              onClick={() => setCat(c)}
            >{c}{c !== 'All' && <span className="cat-count">{PRESETS.filter(p => p.cat === c).length}</span>}</button>
          ))}
        </div>

        <div className="preset-grid">
          {items.map(p => (
            <button
              key={p.name}
              className={`preset ${last === p.name ? 'playing' : ''}`}
              onClick={() => play(p.name)}
            >
              <div className="preset-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <polygon points="5,3 13,8 5,13" fill="currentColor" stroke="none"/>
                </svg>
              </div>
              <div className="preset-body">
                <div className="preset-name mono">{p.name}</div>
                <div className="preset-desc">{p.desc}</div>
              </div>
              <div className="preset-cat mono">{p.cat.toLowerCase()}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
