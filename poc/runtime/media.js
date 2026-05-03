/* media.js — @media query evaluation.
 *
 * Currently handles the most common forms via window.matchMedia:
 *   @media (prefers-reduced-sound: reduce)
 *   @media (max-width: 768px)
 *   @media (prefers-color-scheme: dark)
 *   @media (input-modality: mouse | touch | keyboard | pen)
 *
 * `prefers-reduced-sound` is not yet a CSS standard; falls back to
 * `prefers-reduced-motion` as a proxy.
 *
 * `input-modality` is a custom non-CSS matcher — tracks the last input
 * device the user interacted with (mouse, touch, keyboard, pen) so
 * stylesheets can offer different sounds per input style:
 *   @media (input-modality: keyboard) { :root { master-volume: 0.6; } }
 */

let currentModality = "mouse"; // initial assumption
const modalityListeners = new Set();

function notifyModalityChange() {
  for (const cb of modalityListeners) {
    try { cb(currentModality); } catch (e) {}
  }
}

export function getInputModality() {
  return currentModality;
}

export function onModalityChange(cb) {
  modalityListeners.add(cb);
  return () => modalityListeners.delete(cb);
}

let modalityInstalled = false;
export function installModalityTracker() {
  if (modalityInstalled || typeof document === "undefined") return;
  modalityInstalled = true;
  const set = (m) => {
    if (m !== currentModality) {
      currentModality = m;
      notifyModalityChange();
    }
  };
  document.addEventListener("mousedown", (e) => set(e.pointerType === "pen" ? "pen" : "mouse"), true);
  document.addEventListener("touchstart", () => set("touch"), { capture: true, passive: true });
  document.addEventListener("keydown", (e) => {
    // Modifier-only keys (Tab, Shift, etc.) plus printables count.
    if (!e.metaKey || e.key !== "Meta") set("keyboard");
  }, true);
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") set("pen");
    else if (e.pointerType === "touch") set("touch");
    else set("mouse");
  }, true);
}

export function matchMediaQuery(cond) {
  // input-modality: <kind> — custom, evaluated against tracked state.
  const im = cond.match(/^input-modality\s*:\s*([\w-]+)$/i);
  if (im) return currentModality === im[1].toLowerCase();
  try {
    if (window.matchMedia) {
      const m = window.matchMedia(`(${cond})`);
      if (m && typeof m.matches === "boolean") return m.matches;
    }
  } catch (e) {}
  if (/prefers-reduced-sound\s*:\s*reduce/i.test(cond)) {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// applyMediaToRoot was here for an earlier PoC where @media handling
// applied separately to :root config. Replaced by the simpler approach
// in index.js#bindAll: filter `active` rules by `matchMediaQuery(r.mediaCondition)`,
// which uniformly drops media-non-matching rules (including @media :root).
