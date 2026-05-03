/* global React, ACS */
const { useState: useStateCG, useRef: useRefCG } = React;

/* ---------- Components Gallery ----------
 *
 * A shadcn-style master/detail layout. The grid shows compact thumbnails
 * of common UI primitives (button, toast, dialog, switch, tabs, input,
 * slider, checkbox); clicking a card promotes it to the detail panel
 * with a richer interactive preview + the ACS rule that binds sound to
 * that component shape.
 *
 * Each entry is meant to demonstrate a distinct ACS pattern:
 *   - Button     → class-based variant + per-element pitch/volume
 *   - Toast      → sound-on-appear + IntersectionObserver semantics
 *   - Switch     → [data-on] attribute selector (state → sound)
 *   - Tabs       → click on tablist items
 *   - Input      → :on-input (per-keystroke)
 *   - Dialog     → per-element room override (small-room inside modal)
 *   - Slider     → :on-input (range scrubbing)
 *   - Checkbox   → click + checked state via [aria-checked]
 */

function play(name, opts) {
  if (!window.ACS || !window.ACS.isEnabled || !window.ACS.isEnabled()) return;
  const decls = { sound: name };
  if (opts) Object.assign(decls, opts);
  window.ACS.trigger(decls, "click");
}

// ---------- Lo-fi wireframe thumbnails ----------
// All thumbs drawn in a 200×100 viewBox with 1.5px strokes — schematic
// shapes, no fills (or single accent fill for active state). Mirrors
// the Figma "Wireframe" library aesthetic. Currentcolor inherits the
// muted-fg token so light/dark themes stay consistent.

function Wf({ children }) {
  return (
    <svg viewBox="0 0 200 100" className="cg-wf"
         fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function ThumbButton() {
  return <Wf>
    {/* Two button outlines, primary one filled */}
    <rect x="40"  y="38" width="52" height="24" rx="4" fill="currentColor" />
    <rect x="108" y="38" width="52" height="24" rx="4" />
  </Wf>;
}
function ThumbToast() {
  return <Wf>
    {/* Toast pill with leading accent + two text lines */}
    <rect x="32" y="38" width="136" height="24" rx="4" />
    <line x1="38" y1="42" x2="38" y2="58" strokeWidth="3" />
    <line x1="48" y1="46" x2="120" y2="46" />
    <line x1="48" y1="54" x2="100" y2="54" />
  </Wf>;
}
function ThumbSwitch() {
  return <Wf>
    {/* Two pill switches: on + off */}
    <rect x="42"  y="40" width="48" height="20" rx="10" fill="currentColor" />
    <circle cx="80" cy="50" r="6" fill="white" />
    <rect x="110" y="40" width="48" height="20" rx="10" />
    <circle cx="120" cy="50" r="6" fill="currentColor" />
  </Wf>;
}
function ThumbTabs() {
  return <Wf>
    {/* Three tab pills inside a pill container, first is active */}
    <rect x="30" y="38" width="140" height="24" rx="6" />
    <rect x="34" y="42" width="44" height="16" rx="3" fill="currentColor" />
    <line x1="92"  y1="50" x2="118" y2="50" />
    <line x1="130" y1="50" x2="158" y2="50" />
  </Wf>;
}
function ThumbInput() {
  return <Wf>
    {/* Bordered input with caret + label line above */}
    <line x1="40" y1="32" x2="80" y2="32" />
    <rect x="40" y="40" width="120" height="24" rx="4" />
    <line x1="48" y1="46" x2="48" y2="58" strokeWidth="2" />
  </Wf>;
}
function ThumbDialog() {
  return <Wf>
    {/* Window with title-bar dots + content lines */}
    <rect x="40" y="22" width="120" height="60" rx="6" />
    <line x1="40" y1="36" x2="160" y2="36" />
    <circle cx="48" cy="29" r="2" fill="currentColor" />
    <circle cx="56" cy="29" r="2" fill="currentColor" />
    <circle cx="64" cy="29" r="2" fill="currentColor" />
    <line x1="50" y1="50" x2="150" y2="50" />
    <line x1="50" y1="58" x2="130" y2="58" />
    <line x1="50" y1="66" x2="110" y2="66" />
  </Wf>;
}
function ThumbSlider() {
  return <Wf>
    {/* Track with filled portion + circular thumb */}
    <line x1="32" y1="50" x2="168" y2="50" />
    <line x1="32" y1="50" x2="110" y2="50" strokeWidth="2.5" />
    <circle cx="110" cy="50" r="6" fill="white" stroke="currentColor" strokeWidth="2" />
  </Wf>;
}
function ThumbCheck() {
  return <Wf>
    {/* Checked + unchecked + label lines */}
    <rect x="30" y="32" width="14" height="14" rx="2" fill="currentColor" />
    <polyline points="33.5,39 36,41.5 41,36" stroke="white" />
    <line x1="54" y1="39" x2="120" y2="39" />
    <rect x="30" y="54" width="14" height="14" rx="2" />
    <line x1="54" y1="61" x2="100" y2="61" />
  </Wf>;
}
function ThumbDropdown() {
  return <Wf>
    {/* Trigger button with caret + open menu beneath */}
    <rect x="40" y="20" width="80" height="20" rx="4" />
    <polyline points="106,28 110,32 114,28" />
    <rect x="40" y="46" width="120" height="40" rx="4" />
    <line x1="50" y1="56" x2="120" y2="56" />
    <line x1="50" y1="66" x2="135" y2="66" />
    <line x1="50" y1="76" x2="110" y2="76" />
  </Wf>;
}
function ThumbTooltip() {
  return <Wf>
    {/* Small bubble pointing to a button */}
    <rect x="60" y="22" width="80" height="20" rx="4" />
    <line x1="98" y1="32" x2="98" y2="52" strokeDasharray="2 3" />
    <rect x="80" y="58" width="40" height="20" rx="4" />
  </Wf>;
}
function ThumbAccordion() {
  return <Wf>
    {/* 3 rows: top expanded with content, middle + bottom collapsed */}
    <rect x="34" y="20" width="132" height="20" rx="3" />
    <polyline points="158,28 154,32 150,28" />
    <line x1="42" y1="44" x2="158" y2="44" strokeDasharray="2 3" />
    <line x1="42" y1="52" x2="140" y2="52" strokeDasharray="2 3" />
    <rect x="34" y="60" width="132" height="14" rx="3" />
    <rect x="34" y="78" width="132" height="14" rx="3" />
  </Wf>;
}
function ThumbRadio() {
  return <Wf>
    {/* Three options, middle selected */}
    <circle cx="44" cy="34" r="6" />
    <line x1="60" y1="34" x2="120" y2="34" />
    <circle cx="44" cy="50" r="6" />
    <circle cx="44" cy="50" r="3" fill="currentColor" />
    <line x1="60" y1="50" x2="140" y2="50" />
    <circle cx="44" cy="66" r="6" />
    <line x1="60" y1="66" x2="100" y2="66" />
  </Wf>;
}
function ThumbProgress() {
  return <Wf>
    {/* Track with 70% filled portion + label-style line */}
    <line x1="38" y1="32" x2="100" y2="32" />
    <line x1="148" y1="32" x2="162" y2="32" />
    <rect x="38" y="44" width="124" height="12" rx="6" />
    <rect x="38" y="44" width="86"  height="12" rx="6" fill="currentColor" />
  </Wf>;
}
function ThumbCommand() {
  return <Wf>
    {/* Search input + 3 result rows with leading dot */}
    <rect x="30" y="18" width="140" height="20" rx="4" />
    <circle cx="42" cy="28" r="3" />
    <line x1="52" y1="28" x2="100" y2="28" strokeDasharray="2 3" />
    <circle cx="42" cy="50" r="2" fill="currentColor" />
    <line x1="50" y1="50" x2="140" y2="50" />
    <circle cx="42" cy="64" r="2" fill="currentColor" />
    <line x1="50" y1="64" x2="120" y2="64" />
    <circle cx="42" cy="78" r="2" fill="currentColor" />
    <line x1="50" y1="78" x2="150" y2="78" />
  </Wf>;
}

// ---------- Full / interactive previews ----------

function FullButton() {
  return (
    <div className="cg-full">
      <button className="cg-btn cg-btn-primary"
              onClick={() => play("pop", { pitch: "+1st" })}>Save changes</button>
      <button className="cg-btn cg-btn-confirm"
              onClick={() => play("success")}>Confirm</button>
      <button className="cg-btn cg-btn-danger"
              onClick={() => play("error", { volume: "0.7" })}>Delete</button>
      <button className="cg-btn"
              onClick={() => play("tap-tactile")}>Cancel</button>
    </div>
  );
}

function FullToast() {
  const [t, setT] = useStateCG([]);
  let next = 0;
  const fire = (kind, sound) => {
    const id = ++next + Date.now();
    play(sound);
    setT((cur) => [...cur, { id, kind }]);
    setTimeout(() => setT((cur) => cur.filter((x) => x.id !== id)), 2400);
  };
  return (
    <div className="cg-full">
      <div className="cg-full-row">
        <button className="cg-btn" onClick={() => fire("success", "success")}>Fire success</button>
        <button className="cg-btn" onClick={() => fire("error", "denied")}>Fire error</button>
        <button className="cg-btn" onClick={() => fire("info", "ding")}>Fire info</button>
      </div>
      <div className="cg-toast-stack">
        {t.map((toast) => (
          <div key={toast.id} className={`cg-toast cg-toast-${toast.kind}`}>
            {toast.kind === "success" && "✓ Build #2417 passed"}
            {toast.kind === "error" && "! Deploy failed"}
            {toast.kind === "info" && "@maya joined the call"}
          </div>
        ))}
      </div>
    </div>
  );
}

function FullSwitch() {
  const [a, setA] = useStateCG(true);
  const [b, setB] = useStateCG(false);
  const [c, setC] = useStateCG(false);
  const flip = (val, set) => {
    play(val ? "toggle-off" : "toggle-on");
    set(!val);
  };
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 14}}>
      {[
        ["Enable notifications", a, () => flip(a, setA)],
        ["Auto-play sounds",     b, () => flip(b, setB)],
        ["Beta features",        c, () => flip(c, setC)],
      ].map(([label, on, fn], i) => (
        <label key={i} className="cg-row">
          <span className="cg-row-label">{label}</span>
          <button className={`cg-sw ${on ? "cg-sw-on" : ""}`}
                  data-on={String(on)}
                  data-state={on ? "checked" : "unchecked"}
                  role="switch"
                  aria-checked={on}
                  onClick={fn}>
            <span className="cg-sw-knob" />
          </button>
        </label>
      ))}
    </div>
  );
}

function FullTabs() {
  const [tab, setTab] = useStateCG("overview");
  const tabs = ["overview", "activity", "settings"];
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch"}}>
      <div className="cg-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={`cg-tab ${tab === t ? "cg-tab-on" : ""}`}
                  onClick={() => { play("toggle-on"); setTab(t); }}>
            {t}
          </button>
        ))}
      </div>
      <div className="cg-tab-body">
        {tab === "overview" && "Overview content — high-level metrics."}
        {tab === "activity" && "Activity content — recent events."}
        {tab === "settings" && "Settings content — configuration options."}
      </div>
    </div>
  );
}

function FullInput() {
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch"}}>
      <label className="cg-row" style={{flexDirection: "column", alignItems: "stretch", gap: 6}}>
        <span className="cg-row-label">Email</span>
        <input className="cg-input"
               placeholder="you@example.com"
               onInput={() => play("keystroke")}
               onFocus={() => play("tick")} />
      </label>
      <label className="cg-row" style={{flexDirection: "column", alignItems: "stretch", gap: 6}}>
        <span className="cg-row-label">Search</span>
        <input className="cg-input"
               placeholder="type to search…"
               onInput={() => play("keystroke")}
               onFocus={() => play("tick")} />
      </label>
    </div>
  );
}

function FullDialog() {
  const [open, setOpen] = useStateCG(false);
  const openIt = () => {
    setOpen(true);
    play("modal-open", { room: "small-room" });
  };
  const closeIt = () => {
    play("modal-close");
    setOpen(false);
  };
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 12}}>
      <div className="cg-full-row">
        <button className="cg-btn cg-btn-primary" onClick={openIt}>Open dialog</button>
      </div>
      {open && (
        <div className="cg-dialog cg-dialog-open" role="dialog">
          <div className="cg-dialog-bar">
            <span className="cg-dot" /><span className="cg-dot" /><span className="cg-dot" />
            <span className="cg-dialog-title">Confirm action</span>
          </div>
          <div className="cg-dialog-body">
            <p>Are you sure you want to continue?</p>
            <div className="cg-full-row">
              <button className="cg-btn cg-btn-confirm" onClick={() => { play("success"); setOpen(false); }}>Continue</button>
              <button className="cg-btn" onClick={closeIt}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FullSlider() {
  const [v, setV] = useStateCG(50);
  // Inline gradient: filled portion from 0..v primary, rest muted.
  // Standard shadcn pattern — keeps the slider native (keyboard / touch
  // handled by the browser) while the fill follows the value.
  const trackBg = `linear-gradient(to right,
    var(--shadcn-primary) 0%, var(--shadcn-primary) ${v}%,
    var(--shadcn-muted)   ${v}%, var(--shadcn-muted)   100%)`;
  return (
    <div className="cg-slider-block">
      <div className="cg-row">
        <span className="cg-row-label">Volume</span>
        <span className="cg-row-value mono">{v}</span>
      </div>
      <input type="range" min="0" max="100" value={v}
             onChange={(e) => setV(parseInt(e.target.value, 10))}
             onInput={() => play("tick", { volume: "0.4" })}
             className="cg-range"
             style={{ background: trackBg }} />
      <p className="cg-slider-note">
        Drag the handle — every value change fires{" "}
        <span className="mono">tick</span> at 0.4 volume.
      </p>
    </div>
  );
}

function FullCheckbox() {
  const [items, setItems] = useStateCG([
    { id: 1, label: "Install dependencies", done: true },
    { id: 2, label: "Compile assets", done: true },
    { id: 3, label: "Run unit tests", done: false },
    { id: 4, label: "Deploy to edge", done: false },
  ]);
  const toggle = (id) => {
    setItems((cur) => cur.map((it) => {
      if (it.id !== id) return it;
      play(it.done ? "tick" : "confirm");
      return { ...it, done: !it.done };
    }));
  };
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 6}}>
      {items.map((it) => (
        <label key={it.id} className="cg-check-row" onClick={() => toggle(it.id)}>
          <span aria-checked={String(it.done)} role="checkbox"
                className={`cg-check ${it.done ? "cg-check-on" : ""}`}>
            {it.done ? "✓" : ""}
          </span>
          <span className="cg-row-label" style={{textDecoration: it.done ? "line-through" : "none", color: it.done ? "var(--ink-3)" : "var(--ink)"}}>{it.label}</span>
        </label>
      ))}
    </div>
  );
}

function FullDropdown() {
  const [open, setOpen] = useStateCG(false);
  const [val, setVal] = useStateCG(null);
  const items = ["Profile", "Settings", "Billing", "Sign out"];
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 12}}>
      <div className="cg-full-row" style={{justifyContent: "flex-start"}}>
        <button className="cg-btn"
                aria-expanded={open}
                onClick={() => { play(open ? "dropdown-close" : "dropdown-open"); setOpen(!open); }}>
          {val || "Account menu"} <span style={{marginLeft: 8, opacity: 0.6}}>▾</span>
        </button>
      </div>
      {open && (
        <div role="menu" className="cg-menu">
          {items.map((it) => (
            <button key={it} role="menuitem" className="cg-menu-item"
                    onMouseEnter={() => play("tick", { volume: "0.25" })}
                    onClick={() => { play("tick"); setVal(it); setOpen(false); }}>
              {it}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Each button owns its own tooltip host so the bubble + tail anchor on
// the actual hovered element. Earlier all 3 buttons routed into a single
// shared host above the row → arrow always pointed at the same X
// regardless of which button you hovered.
function Tooltipped({ label, hint }) {
  const [show, setShow] = useStateCG(false);
  return (
    <span className="cg-tip-host">
      <button className="cg-btn"
              onMouseEnter={() => { play("tick", { volume: "0.3" }); setShow(true); }}
              onMouseLeave={() => setShow(false)}
              onFocus={() => setShow(true)}
              onBlur={() => setShow(false)}>
        {label}
      </button>
      {show && <span className="cg-tip-bubble" role="tooltip">{hint}</span>}
    </span>
  );
}
function FullTooltip() {
  return (
    <div className="cg-full" style={{flexDirection: "row", justifyContent: "center", gap: 12, paddingTop: 28}}>
      <Tooltipped label="Save"   hint="Save changes" />
      <Tooltipped label="Cancel" hint="Discard draft" />
      <Tooltipped label="Delete" hint="Permanently delete" />
    </div>
  );
}

function FullAccordion() {
  const [open, setOpen] = useStateCG("a");
  const items = [
    { id: "a", q: "What is ACS?",       a: "A CSS-like declarative stylesheet language for audio. Same selectors, same cascade, properties target sound." },
    { id: "b", q: "Does it ship sounds?", a: "Yes — 49 calibrated presets are auto-loaded with the runtime. You can override or extend with @sound." },
    { id: "c", q: "Browser support?",   a: "Anything with the Web Audio API (Safari ≥ 14, Chrome / Firefox / Edge current). Falls silent on first-load until user gesture." },
  ];
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 6}}>
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className="cg-accordion-row">
            <button className="cg-accordion-trigger"
                    aria-expanded={isOpen}
                    onClick={() => { play(isOpen ? "dropdown-close" : "dropdown-open"); setOpen(isOpen ? null : it.id); }}>
              <span>{it.q}</span>
              <span className="cg-accordion-caret" style={{transform: isOpen ? "rotate(180deg)" : ""}}>▾</span>
            </button>
            {isOpen && <div className="cg-accordion-body">{it.a}</div>}
          </div>
        );
      })}
    </div>
  );
}

function FullRadio() {
  const [val, setVal] = useStateCG("medium");
  const opts = [
    { id: "low",    label: "Low — minimal CPU, 4-voice cap" },
    { id: "medium", label: "Medium — balanced (default)" },
    { id: "high",   label: "High — 16-voice cap, full reverb" },
  ];
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 10}} role="radiogroup">
      {opts.map((o) => (
        <label key={o.id} className="cg-radio-row" onClick={() => { play("toggle-on"); setVal(o.id); }}>
          <span className={`cg-radio ${val === o.id ? "cg-radio-on" : ""}`}
                role="radio"
                aria-checked={val === o.id}>
            {val === o.id && <span className="cg-radio-dot" />}
          </span>
          <span className="cg-row-label">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function FullProgress() {
  const [pct, setPct] = useStateCG(0);
  const startedRef = useRefCG(false);
  const start = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    play("tick");
    setPct(0);
    const id = setInterval(() => {
      setPct((p) => {
        const next = p + 5 + Math.random() * 8;
        if (next >= 100) {
          clearInterval(id);
          startedRef.current = false;
          play("complete");
          return 100;
        }
        return next;
      });
    }, 90);
  };
  return (
    <div className="cg-full" style={{flexDirection: "column", alignItems: "stretch", gap: 14}}>
      <div className="cg-row">
        <span className="cg-row-label">Building bundle</span>
        <span className="cg-row-value mono">{Math.floor(pct)}%</span>
      </div>
      <div className="cg-progress" role="progressbar" aria-valuenow={Math.floor(pct)} aria-valuemin="0" aria-valuemax="100">
        <div className="cg-progress-fill" style={{width: pct + "%"}} />
      </div>
      <div className="cg-full-row" style={{justifyContent: "flex-start"}}>
        <button className="cg-btn cg-btn-primary" onClick={start} disabled={pct > 0 && pct < 100}>
          {pct === 0 ? "Start build" : pct >= 100 ? "Run again" : "Building…"}
        </button>
      </div>
    </div>
  );
}

function FullCommand() {
  const [q, setQ] = useStateCG("");
  const items = [
    { id: "open",  label: "Open file…",       hint: "⌘O" },
    { id: "save",  label: "Save changes",     hint: "⌘S" },
    { id: "find",  label: "Find in project",  hint: "⌘⇧F" },
    { id: "git",   label: "Commit staged…",   hint: "⌘K ⌘C" },
    { id: "quit",  label: "Quit",             hint: "⌘Q" },
  ];
  const filtered = items.filter((it) => it.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cg-cmd">
      <input className="cg-cmd-input"
             placeholder="Type a command…"
             value={q}
             onInput={() => play("keystroke", { volume: "0.3" })}
             onChange={(e) => setQ(e.target.value)} />
      <ul className="cg-cmd-list" role="listbox">
        {filtered.length === 0 && <li className="cg-cmd-empty">No commands.</li>}
        {filtered.map((it) => (
          <li key={it.id} role="option" className="cg-cmd-item"
              onMouseEnter={() => play("tick", { volume: "0.25" })}
              onClick={() => play("tap-tactile")}>
            <span>{it.label}</span>
            <span className="cg-cmd-hint mono">{it.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Component manifest ----------

const COMPONENTS = [
  {
    id: "button",
    label: "Button",
    note: "BUTTON",
    pattern: "Class variants + pitch override",
    Thumb: ThumbButton,
    Full: FullButton,
    acs: `/* Tag selector + class variants. Each variant overrides
   the cascade with its own preset + per-element decls. */
button             { sound-on-click: tap-tactile; }
button.primary     { sound-on-click: pop;     pitch: +1st; }
button.confirm     { sound-on-click: success; }
button.danger      { sound-on-click: error;   volume: 0.7; }`,
  },
  {
    id: "toast",
    label: "Toast",
    note: "NOTIFY",
    pattern: "sound-on-appear via [data-state]",
    Thumb: ThumbToast,
    Full: FullToast,
    acs: `/* Toasts mount + unmount as DOM nodes. The runtime's
   IntersectionObserver fires sound-on-appear when they
   enter the viewport — different state, different preset. */
[role=alert],
[data-state=success]  { sound-on-appear: success; }
[data-state=error]    { sound-on-appear: denied; }
[data-state=info]     { sound-on-appear: ding; }`,
  },
  {
    id: "switch",
    label: "Switch",
    note: "TOGGLE",
    pattern: "[data-on] attribute selector",
    Thumb: ThumbSwitch,
    Full: FullSwitch,
    acs: `/* Attribute selectors map UI state to sound directly.
   Flipping the data-on attribute is enough — the cascade
   picks the right preset on the next click. */
[data-on="true"]   { sound-on-click: toggle-on; }
[data-on="false"]  { sound-on-click: toggle-off; }`,
  },
  {
    id: "tabs",
    label: "Tabs",
    note: "TABLIST",
    pattern: "ARIA role selector",
    Thumb: ThumbTabs,
    Full: FullTabs,
    acs: `/* Selectors target ARIA roles, the same way
   accessible CSS does. No hover-sound on the active
   tab — already focused, would feel redundant. */
[role=tab]                       { sound-on-click: toggle-on; }
[role=tab][aria-selected="true"] { sound: none; }`,
  },
  {
    id: "input",
    label: "Input",
    note: "FORM",
    pattern: ":on-input + :on-focus pseudo-events",
    Thumb: ThumbInput,
    Full: FullInput,
    acs: `/* Pseudo-events bind to DOM events (input, focus,
   leave, etc.). Per-keystroke feedback feels physical
   without being noisy when you scope volume tightly. */
input:on-focus  { sound: tick; volume: 0.4; }
input:on-input  { sound: keystroke; volume: 0.35; }`,
  },
  {
    id: "dialog",
    label: "Dialog",
    note: "MODAL",
    pattern: "Per-element room override",
    Thumb: ThumbDialog,
    Full: FullDialog,
    acs: `/* room is inheritable, so a dialog's contents play
   inside a tighter acoustic — the audio "follows" the
   visual focus shift into the modal. */
dialog[open] {
  sound-on-appear: modal-open;
  room: small-room;
}
dialog[open] button.confirm { sound-on-click: success; }`,
  },
  {
    id: "slider",
    label: "Slider",
    note: "RANGE",
    pattern: ":on-input throttled scrubbing",
    Thumb: ThumbSlider,
    Full: FullSlider,
    acs: `/* The runtime's throttle.js keeps rapid scrubs from
   piling up — same preset within 25ms is dropped, so
   dragging a slider feels musical instead of buzzy. */
input[type=range]:on-input {
  sound: tick;
  volume: 0.4;
}`,
  },
  {
    id: "checkbox",
    label: "Checkbox",
    note: "CHECKLIST",
    pattern: "[aria-checked] state selector",
    Thumb: ThumbCheck,
    Full: FullCheckbox,
    acs: `/* aria-checked toggles between two presets — confirm
   on check, tick on uncheck. Mirrors CSS accessibility
   patterns 1-to-1; no extra wiring. */
[role=checkbox][aria-checked="false"] { sound-on-click: confirm; }
[role=checkbox][aria-checked="true"]  { sound-on-click: tick; }`,
  },
  {
    id: "dropdown",
    label: "Dropdown",
    note: "MENU",
    pattern: "aria-expanded toggles open/close",
    Thumb: ThumbDropdown,
    Full: FullDropdown,
    acs: `/* Open/close pair — same trigger fires opposite presets
   based on the aria-expanded state. Hover whisper on each
   item @ 0.25 volume so the row "highlights" sonically
   without competing with the eventual click. */
[aria-expanded="false"] { sound-on-click: dropdown-open;  }
[aria-expanded="true"]  { sound-on-click: dropdown-close; }
[role=menuitem]:on-enter { sound: tick; volume: 0.25; }
[role=menuitem]          { sound-on-click: tick; volume: 0.5; }`,
  },
  {
    id: "tooltip",
    label: "Tooltip",
    note: "HINT",
    pattern: "Hover whisper at low volume",
    Thumb: ThumbTooltip,
    Full: FullTooltip,
    acs: `/* Hover sounds want to feel "alive" without nagging.
   Volume 0.3 + a soft tick keeps every hover under
   speech-loudness — present, not pushy. */
[data-tooltip-trigger]:on-enter {
  sound: tick;
  volume: 0.3;
}`,
  },
  {
    id: "accordion",
    label: "Accordion",
    note: "DISCLOSURE",
    pattern: "aria-expanded on each panel",
    Thumb: ThumbAccordion,
    Full: FullAccordion,
    acs: `/* Same open/close pair as a dropdown, but applied to
   <details>/disclosure widgets. ACS doesn't care about
   element type — only the matched attribute. */
.accordion-trigger[aria-expanded="false"] { sound-on-click: dropdown-open; }
.accordion-trigger[aria-expanded="true"]  { sound-on-click: dropdown-close; }`,
  },
  {
    id: "radio",
    label: "Radio group",
    note: "SELECT-ONE",
    pattern: "[role=radio] inside [role=radiogroup]",
    Thumb: ThumbRadio,
    Full: FullRadio,
    acs: `/* All radios fire the same toggle-on; we don't sound
   the implicit "deselect" of the previously-checked one.
   Single-pair feedback is what users expect from real
   hardware radios. */
[role=radiogroup] [role=radio] {
  sound-on-click: toggle-on;
}`,
  },
  {
    id: "progress",
    label: "Progress",
    note: "ASYNC",
    pattern: "Programmatic trigger via helpers.play()",
    Thumb: ThumbProgress,
    Full: FullProgress,
    acs: `/* Progress isn't a DOM event — the cascade can't see
   "build complete." Use the runtime helper to fire a
   sound from JS at the moment of state change. */
import { play } from "acs/helpers";
play("tick");                       // build started
play("complete", { volume: 0.7 });  // 100% reached`,
  },
  {
    id: "command",
    label: "Command menu",
    note: "PALETTE",
    pattern: ":on-input + click on listbox items",
    Thumb: ThumbCommand,
    Full: FullCommand,
    acs: `/* Cmd+K palette — the input fires keystroke per char,
   items fire tap-tactile on click and a soft tick on
   hover so the active row "follows the cursor" sonically. */
[role=combobox]:on-input          { sound: keystroke; volume: 0.3; }
[role=listbox] [role=option]:on-enter {
  sound: tick;
  volume: 0.25;
}
[role=listbox] [role=option] {
  sound-on-click: tap-tactile;
}`,
  },
];

// ---------- Section ----------

window.ComponentsGallery = function ComponentsGallery({ soundOn, requestSound }) {
  const [selectedId, setSelectedId] = useStateCG("button");
  const detailRef = useRefCG(null);

  // Pick a component AND scroll the detail panel into view. block:'start'
  // aligns the panel's top with the viewport; nav (sticky) sits above it.
  // requestAnimationFrame defers the scroll until after the React commit
  // so the new content is measured + laid out before the browser animates.
  const selectAndFocus = (id) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };
  const selected = COMPONENTS.find((c) => c.id === selectedId) || COMPONENTS[0];
  const Full = selected.Full;
  return (
    <section className="section" id="components">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">Components</span>
          <h2 className="section-title">Eight UI primitives.<br/>Eight ACS rules.</h2>
          <p className="section-sub">Click a card. The detail panel shows a working component on the left and the exact ACS rule that wires its sound on the right. No JS event handlers, no <code className="mono">play()</code> calls — the cascade does it.</p>
        </div>

        <div className="cg-grid">
          {COMPONENTS.map((c) => {
            const Thumb = c.Thumb;
            return (
              <button key={c.id}
                      className={`cg-card ${selectedId === c.id ? "is-selected" : ""}`}
                      onClick={() => selectAndFocus(c.id)}>
                <div className="cg-card-thumb"><Thumb /></div>
                <div className="cg-card-foot">
                  <span className="cg-card-note mono">{c.note}</span>
                  <span className="cg-card-label">{c.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="cg-detail" ref={detailRef} tabIndex="-1">
          <div className="cg-detail-head">
            <div>
              <span className="eyebrow">Selected</span>
              <h3 className="cg-detail-title">{selected.label}</h3>
              <p className="cg-detail-sub">{selected.pattern}</p>
            </div>
            {!soundOn && (
              <button className="btn btn-accent" onClick={requestSound}>Enable sound to play</button>
            )}
          </div>
          <div className="cg-detail-body">
            <div className="cg-preview">
              <div className="cg-preview-frame">
                <Full key={selected.id} />
              </div>
              <div className="cg-preview-tag mono">PREVIEW</div>
            </div>
            <div className="cg-code">
              <div className="window">
                <div className="window-bar">
                  <div className="window-dots"><span></span><span></span><span></span></div>
                  <div className="window-title mono">{selected.id}.acs</div>
                  <div className="window-actions">
                    <button className="copy-btn mono" onClick={() => navigator.clipboard?.writeText(selected.acs)}>copy</button>
                  </div>
                </div>
                <pre className="code code-flush mono">{selected.acs}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
