"use client";

import { useSyncExternalStore } from "react";

/* Read browser-only values without a server/client mismatch: the server renders the fallback, the browser the real value. */

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

/** Tell components using useLocalItem that this tab changed localStorage. */
export function emitLocalChange() {
  listeners.forEach((l) => l());
}

export function useLocalItem(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => { try { return localStorage.getItem(key); } catch { return null; } },
    () => null,
  );
}

const noop = () => () => {};
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
/** The URL hash, e.g. "#phase-3" ("" on the server). */
export function useHash() {
  return useSyncExternalStore(subscribeHash, () => location.hash, () => "");
}
