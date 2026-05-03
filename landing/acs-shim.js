/* acs-shim.js — adapter that exposes landing/audio-engine.js's API
 * surface on top of the real ACS runtime (poc/runtime/).
 *
 * Landing components were built against a mini in-house engine
 * (ACS.play / enable / setMaster / setRoom / ...). Once landing loads
 * the real runtime, those calls go through this shim and become real
 * `trigger({sound: ...}, 'sound')` / `setMasterConfig({...})` calls.
 *
 * This file MUST load AFTER the runtime module finishes evaluating
 * (window.ACS exists). The runtime is `<script type="module">` so it's
 * deferred — load this script with `defer` too, or after a tiny poll.
 */
(function () {
  function install() {
    const A = window.ACS;
    if (!A || typeof A.trigger !== "function") return false;
    // Sound starts ENABLED so the cascade fires from the first click —
    // the browser's audio policy still requires a user gesture to start
    // the AudioContext, but we can resume it automatically on the first
    // pointerdown/keydown rather than gating behind an explicit "Enable"
    // toggle. Less friction, identical legality.
    A.setEnabled(true);

    // One-shot auto-resume on the first real user gesture. Most browsers
    // require .resume() to be called inside a synchronous gesture
    // handler — fire a silent trigger that touches ensureCtx() so the
    // first audible click is in fact audible.
    const armCtx = () => {
      try { A.trigger({ sound: "" }, "sound"); } catch (e) {}
      window.removeEventListener("pointerdown", armCtx, true);
      window.removeEventListener("keydown",     armCtx, true);
    };
    window.addEventListener("pointerdown", armCtx, true);
    window.addEventListener("keydown",     armCtx, true);

    A.enable  = function () { A.setEnabled(true); try { A.trigger({ sound: "" }, "sound"); } catch (e) {} };
    A.disable = function () { A.setEnabled(false); };
    // Note: don't override A.isEnabled — runtime ships its own.

    // landing.play(name) → ACS trigger. Shim-level early-return is
    // belt-and-suspenders; the runtime gate is the authoritative one.
    const origPlay = A.play; // guard if real API later adds .play
    A.play = function (name) {
      if (!A.isEnabled()) return;
      if (origPlay && origPlay !== A.play) {
        try { return origPlay.call(A, name); } catch (e) {}
      }
      A.trigger({ sound: name }, "sound");
    };

    // master / room knobs — landing's tweaks panel calls these live.
    A.setMaster = function (v) {
      if (A.setMasterConfig) A.setMasterConfig({ "master-volume": String(v) });
    };
    A.setRoom = function (amount) {
      // Landing's `setRoom(amount)` was the wet/dry mix on a fixed reverb.
      // Map to room-mix on the current default room.
      if (A.setMasterConfig) A.setMasterConfig({ "room-mix": String(amount) });
    };
    A.setReverbSize = function (seconds) {
      // Map seconds to room preset bucket. Best-effort: short→small,
      // mid→chamber, long→large-hall.
      const room = seconds < 0.6 ? "small-room"
                 : seconds < 1.2 ? "chamber"
                 : seconds < 2.0 ? "medium-room"
                 : "large-hall";
      if (A.setMasterConfig) A.setMasterConfig({ room });
    };

    // Landing's ACS.presets() returned a list of names. Real ACS exposes
    // `presets` and `customPresets` as objects.
    if (typeof A.presets === "object") {
      const realPresets = A.presets;
      const realCustoms = A.customPresets || {};
      A.presets = function () {
        return Array.from(new Set([
          ...Object.keys(realPresets),
          ...Object.keys(realCustoms),
        ]));
      };
      // Some legacy accessors may try `A.presets.someName` — restore that
      // by attaching the original keys onto the function object.
      Object.assign(A.presets, realPresets);
    }

    return true;
  }

  if (install()) return;
  // Poll up to ~5s for the runtime module to finish loading.
  const started = Date.now();
  const id = setInterval(() => {
    if (install() || Date.now() - started > 5000) clearInterval(id);
  }, 50);
})();
