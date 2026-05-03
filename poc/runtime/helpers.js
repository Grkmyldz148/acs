/* helpers.js — small framework-agnostic adapter helpers.
 *
 * ACS's main API is declarative: you write selectors in `.acs` and the
 * runtime wires DOM events. These helpers cover the cases where you need
 * to fire a sound *programmatically* from JS — async resolution, state
 * change notifications, conditional triggers — without manually building
 * a decls object every time.
 *
 * Exported on `window.ACS.helpers`:
 *   play(name, opts?)         — trigger preset by name with optional decls
 *   attach(el, name, event?)  — bind preset to a DOM event on an element
 *   useSound(name, opts?)     — minimal React-style hook (works with any
 *                                hook-compatible library that exposes
 *                                `useCallback`); returns a stable callback
 */

// Trigger a preset by name. `opts` is an optional decls object — pass
// volume / pitch / room / mood / sound-mood-mix here. Falls back silently
// if window.ACS isn't ready yet (runtime still loading).
export function play(name, opts) {
  if (typeof window === "undefined") return;
  const ACS = window.ACS;
  if (!ACS || !ACS.trigger || !name) return;
  const decls = { sound: name };
  if (opts && typeof opts === "object") {
    for (const k in opts) decls[k] = String(opts[k]);
  }
  ACS.trigger(decls, "click");
}

// Attach a preset to a DOM event. Returns an unbind fn for cleanup.
//   const off = attach(myButton, "pop");           // default: click
//   const off = attach(textarea, "tick", "input");
export function attach(el, name, event = "click") {
  if (!el || !el.addEventListener) return () => {};
  const handler = () => play(name);
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
}

// React-flavored hook (works with any library exposing `useCallback`).
// Pass the hook lib as the first arg so we don't have a hard React peer:
//
//   import { useCallback } from "react";
//   import { useSound } from "@acs/runtime/helpers";
//   const ding = useSound({ useCallback }, "ding", { volume: 0.7 });
//   <button onClick={ding} />
//
// The returned callback is stable across renders as long as `name` and
// `opts` (shallow-compared by JSON) don't change.
export function useSound(hooks, name, opts) {
  if (!hooks || typeof hooks.useCallback !== "function") {
    throw new Error("[acs] useSound requires { useCallback } passed in");
  }
  const optsKey = opts ? JSON.stringify(opts) : "";
  return hooks.useCallback(() => play(name, opts), [name, optsKey]);
}
