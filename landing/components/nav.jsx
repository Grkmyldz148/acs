/* global React */
const { useState, useEffect, useRef, useCallback } = React;

// ---------- Code highlighter ----------
function highlightAcss(src) {
  // Order matters: comments → strings → at-rules → selectors → properties → values
  let html = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>');
  // At-rules
  html = html.replace(/(@[\w-]+)/g, '<span class="tok-at">$1</span>');
  // Property: value pairs (only inside braces, line-based)
  html = html.replace(/^(\s*)([a-z-]+)(\s*:\s*)([^;{}\n]+)(;?)/gm, (m, indent, prop, sep, val, semi) => {
    // Skip if prop looks like a selector (contains . # [ : not at start)
    if (prop.startsWith('--') || /^[a-z-]+$/.test(prop)) {
      const valHtml = val
        .replace(/(\d+\.?\d*)(hz|khz|ms|s|st|db|px|%)?/gi, '<span class="tok-num">$1$2</span>')
        .replace(/\b(none|auto|on|off|true|false)\b/g, '<span class="tok-val">$1</span>');
      return `${indent}<span class="tok-prop">${prop}</span>${sep}<span class="tok-val">${valHtml}</span>${semi}`;
    }
    return m;
  });
  // Selectors before {
  html = html.replace(/^([^{}\n]+)\{/gm, (m, sel) => {
    if (sel.includes('tok-')) return m;
    return `<span class="tok-sel">${sel.trim()}</span> {`;
  });

  return html;
}

window.CodeBlock = function CodeBlock({ children, className = '' }) {
  const html = highlightAcss(children);
  return (
    <pre className={`code ${className}`}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
};

// ---------- Sound toggle (top nav) ----------
window.SoundToggle = function SoundToggle({ enabled, onToggle }) {
  return (
    <button
      className={`sound-toggle ${enabled ? 'on' : ''}`}
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? 'Sounds on — click to mute' : 'Click to enable demo sounds'}
    >
      <span className="dot"></span>
      <span>{enabled ? 'sound on' : 'sound off'}</span>
    </button>
  );
};

// ---------- Theme toggle ----------
window.ThemeToggle = function ThemeToggle({ theme, setTheme }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="icon-btn"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} theme`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z"/>
        </svg>
      )}
    </button>
  );
};

// ---------- Nav ----------
/* Equalizer-style mark — four vertical bars in a cascade silhouette.
 * Reads instantly as "audio" and is visually distinct from a letter-A
 * brand (which collides with generic CSS-style marks). Reused in the
 * footer and as the favicon (data: URI in index.html). */
window.BrandMark = function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect x="2"  y="6"  width="2" height="4" rx="1"/>
        <rect x="5.5" y="3"  width="2" height="10" rx="1"/>
        <rect x="9"  y="5"  width="2" height="6" rx="1"/>
        <rect x="12.5" y="7" width="2" height="2" rx="1"/>
      </svg>
    </span>
  );
};

window.Nav = function Nav({ theme, setTheme, soundOn, onToggleSound }) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a href="#top" className="brand">
          <ACSShield size={28} />
          <span style={{color:'var(--ink-3)', fontWeight:400, fontSize:'var(--tx-2)', marginLeft:4}}>v0.9</span>
        </a>
        <nav className="nav-links">
          <a href="#components">Components</a>
          <a href="#features">Features</a>
          <a href="#presets">Presets</a>
          <a href="#examples">Examples</a>
          <a href="#install">Install</a>
        </nav>
        <div className="nav-spacer"></div>
        <div className="nav-actions">
          <SoundToggle enabled={soundOn} onToggle={onToggleSound} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <a className="icon-btn" href="https://github.com/Grkmyldz148/acs" title="GitHub" aria-label="GitHub" target="_blank" rel="noopener">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
