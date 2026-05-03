/* devtools.js — drop-in introspection overlay for ACS.
 *
 * Surfaces what's actually happening at runtime — which preset fires,
 * matched against which selector, with what calibration factor and
 * mood/room state. Subscribes via the public window.ACS.onTrigger API
 * so it works for both DOM events and direct ACS.trigger() calls.
 *
 * Usage:
 *   window.ACS.devtools.mount();    // render at bottom-right
 *   window.ACS.devtools.unmount();  // tear down
 *   window.ACS.devtools.toggle();
 *
 * Designed to be opt-in — adds zero overhead when not mounted.
 */

const PANEL_ID = "acs-devtools-panel";
const MAX_ROWS = 20;

let unsubscribe = null;
let panel = null;
let rows = []; // { name, atMs, factor, decls, source }

function describeSource(el) {
  if (!el || !el.tagName) return "—";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = (el.className && typeof el.className === "string")
    ? "." + el.className.trim().split(/\s+/).join(".")
    : "";
  return tag + id + cls;
}

function styleSheet() {
  return `
    #${PANEL_ID} {
      position: fixed; right: 12px; bottom: 12px; z-index: 2147483647;
      width: 340px; max-height: 50vh;
      background: rgba(10, 10, 14, 0.96); color: #e4e4e7;
      border: 1px solid #27272a; border-radius: 10px;
      font: 11px/1.4 ui-monospace, "SF Mono", Menlo, monospace;
      box-shadow: 0 10px 30px rgba(0,0,0,.45);
      display: flex; flex-direction: column; overflow: hidden;
      backdrop-filter: blur(8px);
    }
    #${PANEL_ID} header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid #27272a;
      font-weight: 600; letter-spacing: .02em;
    }
    #${PANEL_ID} header .title { flex: 1; color: #fafafa; }
    #${PANEL_ID} header .stat { color: #a1a1aa; font-weight: 400; }
    #${PANEL_ID} button {
      background: transparent; color: #71717a; border: 0;
      cursor: pointer; padding: 2px 6px; font: inherit;
    }
    #${PANEL_ID} button:hover { color: #fafafa; }
    #${PANEL_ID} .controls {
      display: flex; gap: 6px; padding: 6px 10px; border-bottom: 1px solid #1c1c20;
      color: #a1a1aa;
    }
    #${PANEL_ID} .controls label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
    #${PANEL_ID} .log { flex: 1; overflow-y: auto; padding: 4px 0; }
    #${PANEL_ID} .row {
      display: grid; grid-template-columns: 1fr auto auto;
      gap: 8px; padding: 4px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    #${PANEL_ID} .row .name { color: #fafafa; }
    #${PANEL_ID} .row .source { color: #71717a; font-size: 10px; }
    #${PANEL_ID} .row .factor { color: #22c55e; font-variant-numeric: tabular-nums; }
    #${PANEL_ID} .row .meta { grid-column: 1 / -1; color: #71717a; font-size: 10px; }
    #${PANEL_ID} .empty { padding: 20px; text-align: center; color: #52525b; }
  `;
}

function ensurePanel() {
  if (panel) return panel;
  if (typeof document === "undefined") return null;

  const style = document.createElement("style");
  style.textContent = styleSheet();
  document.head.appendChild(style);

  panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header>
      <span class="title">ACS devtools</span>
      <span class="stat" id="acs-devtools-count">0 triggers</span>
      <button id="acs-devtools-clear" title="Clear log">⟲</button>
      <button id="acs-devtools-close" title="Hide">✕</button>
    </header>
    <div class="controls">
      <label><input type="checkbox" id="acs-devtools-mute" /> mute</label>
      <label><input type="checkbox" id="acs-devtools-cal" checked /> calibration</label>
      <span style="margin-left:auto;" id="acs-devtools-state"></span>
    </div>
    <div class="log" id="acs-devtools-log">
      <div class="empty">Waiting for triggers…</div>
    </div>
  `;
  document.body.appendChild(panel);

  panel.querySelector("#acs-devtools-clear").addEventListener("click", () => {
    rows = [];
    render();
  });
  panel.querySelector("#acs-devtools-close").addEventListener("click", unmount);

  const muteEl = panel.querySelector("#acs-devtools-mute");
  muteEl.addEventListener("change", () => {
    if (window.ACS && window.ACS.setMasterConfig) {
      window.ACS.setMasterConfig({ "master-volume": muteEl.checked ? "0" : "1" });
    }
  });
  const calEl = panel.querySelector("#acs-devtools-cal");
  calEl.addEventListener("change", () => {
    if (window.ACS && window.ACS.enableAutoLoudness) {
      window.ACS.enableAutoLoudness(calEl.checked);
    }
  });

  return panel;
}

function render() {
  if (!panel) return;
  const log = panel.querySelector("#acs-devtools-log");
  const count = panel.querySelector("#acs-devtools-count");
  count.textContent = `${rows.length} trigger${rows.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    log.innerHTML = `<div class="empty">Waiting for triggers…</div>`;
    return;
  }

  // Latest first.
  const html = rows.slice().reverse().map((r) => {
    const factorTxt = r.factor != null ? `×${r.factor.toFixed(2)}` : "";
    const meta = [];
    if (r.decls.room) meta.push(`room: ${r.decls.room}`);
    if (r.decls["sound-mood"]) {
      const mix = r.decls["sound-mood-mix"];
      meta.push(`mood: ${r.decls["sound-mood"]}${mix && +mix < 1 ? ` (mix ${(+mix).toFixed(2)})` : ""}`);
    }
    if (r.decls.pitch) meta.push(`pitch: ${r.decls.pitch}`);
    if (r.decls.volume) meta.push(`vol: ${r.decls.volume}`);
    return `<div class="row">
      <div class="name">${escapeHtml(r.name)}</div>
      <div class="source">${escapeHtml(r.source)}</div>
      <div class="factor">${factorTxt}</div>
      ${meta.length ? `<div class="meta">${escapeHtml(meta.join(" · "))}</div>` : ""}
    </div>`;
  }).join("");
  log.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[c]);
}

export function mount() {
  if (panel) return;
  if (!ensurePanel()) return;
  if (window.ACS && window.ACS.onTrigger) {
    unsubscribe = window.ACS.onTrigger((name, decls, source) => {
      const factors = window.ACS.calibrationFactors ? window.ACS.calibrationFactors() : {};
      rows.push({
        name,
        atMs: performance.now(),
        factor: factors[name] ?? null,
        decls: { ...decls },
        source: describeSource(source),
      });
      if (rows.length > MAX_ROWS) rows.shift();
      render();
    });
  }
  render();
}

export function unmount() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (panel) { panel.remove(); panel = null; }
}

export function toggle() {
  if (panel) unmount();
  else mount();
}
