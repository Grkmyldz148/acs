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
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuOpen;

  // Hide-on-scroll — implemented as direct DOM class toggling rather
  // than React state, so the scroll listener doesn't go through a render
  // cycle on every frame. Refs sidestep stale-closure issues for the
  // menu-open guard.
  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    let lastY = window.scrollY;
    let pending = false;
    const TOP_ZONE = 80;
    const HIDE_DELTA = 6;
    const REVEAL_DELTA = 4;

    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (menuOpenRef.current) {
          el.classList.remove('nav-hidden');
          lastY = window.scrollY;
          return;
        }
        const y = window.scrollY;
        const dy = y - lastY;
        if (y < TOP_ZONE) {
          el.classList.remove('nav-hidden');
        } else if (dy > HIDE_DELTA) {
          el.classList.add('nav-hidden');
        } else if (dy < -REVEAL_DELTA) {
          el.classList.remove('nav-hidden');
        }
        lastY = y;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '/docs/', label: 'Docs' },
    { href: '#components', label: 'Components' },
    { href: '#features', label: 'Features' },
    { href: '#presets', label: 'Presets' },
    { href: '#examples', label: 'Examples' },
    { href: '#install', label: 'Install' },
  ];

  // Lock background scroll when the drawer is open. Setting just
  // `body.overflow = hidden` is enough on desktop, but iOS Safari ignores
  // it for touch scroll. The robust pattern is: capture scroll position,
  // pin <body> in place with position:fixed + negative top, restore on
  // close. We also lock <html> for engines (Firefox) where body alone
  // doesn't propagate.
  useEffect(() => {
    if (!menuOpen) return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop:      body.style.top,
      bodyWidth:    body.style.width,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top      = `-${scrollY}px`;
    body.style.width    = '100%';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top      = prev.bodyTop;
      body.style.width    = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [menuOpen]);

  // Close the drawer when the viewport returns to desktop width — otherwise
  // the user resizes back up and the overlay stays orphaned.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 721px)');
    const handler = (e) => { if (e.matches) setMenuOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuOpen]);

  // Drawer + backdrop are rendered as siblings of the <header>, NOT
  // children. The nav has backdrop-filter + transform which create a
  // stacking context — fixed children get trapped inside it (positioned
  // relative to the nav, not the viewport). Promoting them to siblings
  // moves the drawer back into the document's root stacking context.
  return (
    <>
    <header ref={headerRef} className="nav">
      <div className="wrap nav-inner">
        <a href="#top" className="brand">
          <ACSShield size={28} />
          <span style={{color:'var(--ink-3)', fontWeight:400, fontSize:'var(--tx-2)', marginLeft:4}}>v0.9</span>
        </a>
        <nav className="nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-spacer"></div>
        <div className="nav-actions">
          <SoundToggle enabled={soundOn} onToggle={onToggleSound} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <a className="icon-btn nav-github" href="https://github.com/Grkmyldz148/acs" title="GitHub" aria-label="GitHub" target="_blank" rel="noopener">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
          <button
            className="icon-btn nav-burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <path d="M4 4L12 12" />
                  <path d="M12 4L4 12" />
                </>
              ) : (
                <>
                  <path d="M2.5 5h11" />
                  <path d="M2.5 8h11" />
                  <path d="M2.5 11h11" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
    </header>

    {/* Mobile drawer + backdrop — promoted out of the <header> so they're
        not trapped inside the nav's transform/backdrop-filter stacking
        context. They're rendered always; CSS handles enter/exit. */}
    <div
      className={`nav-backdrop ${menuOpen ? 'open' : ''}`}
      onClick={() => setMenuOpen(false)}
      aria-hidden="true"
    />
    <div
      id="mobile-nav-drawer"
      className={`nav-drawer ${menuOpen ? 'open' : ''}`}
      aria-hidden={!menuOpen}
    >
      <nav className="nav-drawer-links" onClick={() => setMenuOpen(false)}>
        {links.map((l) => (
          <a key={l.href} href={l.href}>{l.label}</a>
        ))}
        <div className="nav-drawer-divider" />
        <a href="https://github.com/Grkmyldz148/acs" target="_blank" rel="noopener">GitHub</a>
        <a href="https://www.npmjs.com/package/acs-audio" target="_blank" rel="noopener">npm package</a>
        <a href="https://marketplace.visualstudio.com/items?itemName=audio-cascading-style-sheets.acs-language" target="_blank" rel="noopener">VSCode extension</a>
      </nav>
    </div>
    </>
  );
};
