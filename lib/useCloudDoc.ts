"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { getSupabase } from "@/lib/supabase/client";
import { readJSON, writeJSON } from "@/lib/storage";

export type SyncStatus = "device" | "saving" | "saved" | "offline";
type Doc = { updatedAt: number };
type Edit<T> = (d: T) => T;

export type CloudDocOptions<T extends Doc> = {
  localKey: string;
  empty: () => T;
  normalize: (raw: unknown) => T;
  load: (sb: SupabaseClient, uid: string) => Promise<T | null>;
  save: (sb: SupabaseClient, uid: string, doc: T) => Promise<void>;
};

/** Don't re-read the account more often than this when the tab regains focus. */
const REFRESH_MS = 5000;

/*
 * A document kept in this browser and mirrored to the signed-in account.
 *
 * Edits show at once and are saved to this device. For the account they are queued, and every sync first
 * reads the account's copy, then replays the queued edits on top of whichever copy is newer. So an edit made
 * before the account loaded (a new phone) or in a tab left open for days never overwrites progress saved from
 * another device; it's added to it. Edits must be pure functions of the doc they're given (no ids or random
 * values made inside them), because they can run more than once.
 *
 * `loads` goes up whenever the document is replaced from storage rather than edited here.
 */
export function useCloudDoc<T extends Doc>(opts: CloudDocOptions<T>) {
  const { user, ready } = useAuth();
  const o = useRef(opts);

  const [doc, setDoc] = useState<T>(opts.empty);
  const [hydrated, setHydrated] = useState(false);
  /** The account's copy has been read at least once (or the read failed), so `doc` is as complete as it'll get. */
  const [reached, setReached] = useState(false);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("device");
  const docRef = useRef(doc);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const uid = user?.id ?? null;
  const uidRef = useRef(uid);
  const readyRef = useRef(ready);
  useLayoutEffect(() => { o.current = opts; uidRef.current = uid; readyRef.current = ready; });

  /** Edits not yet confirmed saved to the account, and the copy they were first applied to. */
  const pending = useRef<Edit<T>[]>([]);
  const base = useRef<T | null>(null);
  const lastSync = useRef(0);
  const retry = useRef<() => void>(() => {});

  const show = useCallback((d: T, fromStorage: boolean) => {
    docRef.current = d;
    setDoc(d);
    if (fromStorage) setLoads((n) => n + 1);
  }, []);

  // 1. this device
  useEffect(() => {
    const raw = readJSON<unknown>(o.current.localKey);
    if (raw) show(o.current.normalize(raw), true);
    else setLoads((n) => n + 1);
    setHydrated(true);
  }, [show]);

  /** Read the account, merge in queued edits, save. Runs one at a time. */
  const sync = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const sb = getSupabase(), id = uidRef.current;
    if (!sb || !id) return;
    chain.current = chain.current.then(async () => {
      if (uidRef.current !== id) return;
      const edits = pending.current, from = base.current;
      pending.current = [];
      base.current = null;
      if (edits.length) setStatus("saving");
      try {
        const remote = await o.current.load(sb, id);
        if (uidRef.current !== id) return;
        lastSync.current = Date.now();
        const remoteAt = remote?.updatedAt ?? 0;

        if (!edits.length) {
          // nothing queued: newest copy wins (this also uploads progress made on this device before signing in).
          // Compare with the copy from before any edit made while this read was in flight, not the edited one.
          const local = base.current ?? docRef.current;
          if (remote && remoteAt > local.updatedAt) {
            const later = pending.current;
            if (later.length) base.current = remote;
            const visible = later.length ? { ...later.reduce((d, f) => f(d), remote), updatedAt: Date.now() } : remote;
            writeJSON(o.current.localKey, visible);
            show(visible, true);
          } else if (local.updatedAt > remoteAt) {
            await o.current.save(sb, id, local);
          }
          setStatus(pending.current.length ? "saving" : "saved");
          return;
        }

        // replay this tab's edits on whichever copy is newer: the account's, or the one they were made on
        const start = remote && (!from || remoteAt > from.updatedAt) ? remote : (from ?? docRef.current);
        const merged = { ...edits.reduce((d, f) => f(d), start), updatedAt: Math.max(Date.now(), remoteAt + 1) };
        await o.current.save(sb, id, merged);
        // edits made while saving are re-applied on top, and queued for the next sync
        const later = pending.current;
        const visible = later.length ? { ...later.reduce((d, f) => f(d), merged), updatedAt: Date.now() } : merged;
        if (later.length) base.current = merged;
        writeJSON(o.current.localKey, visible);
        show(visible, start === remote);
        setStatus(later.length ? "saving" : "saved");
      } catch {
        // keep the edits for the next try, in order, ahead of any made since
        pending.current = edits.concat(pending.current);
        base.current = from ?? base.current;
        if (uidRef.current === id) {
          setStatus("offline");
          if (pending.current.length && !timer.current) timer.current = setTimeout(() => retry.current(), 15000); // try again
        }
      } finally {
        if (uidRef.current === id) setReached(true);
      }
    });
  }, [show]);
  useLayoutEffect(() => { retry.current = sync; }, [sync]);

  // signed out for sure: edits stay on this device only
  useEffect(() => {
    if (ready && !uid) { pending.current = []; base.current = null; }
  }, [ready, uid]);

  // 2. the account: load on sign-in, then re-check whenever the tab comes back or the network returns
  useEffect(() => {
    if (!hydrated || !uid || !getSupabase()) return;
    sync();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (pending.current.length || Date.now() - lastSync.current > REFRESH_MS) sync();
    };
    const flush = () => { if (document.visibilityState === "hidden" && pending.current.length) sync(); };
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [hydrated, uid, sync]);

  const update = useCallback((fn: Edit<T>) => {
    // queue for the account when signed in, or while sign-in is still being checked (replayed once it is)
    const signedIn = Boolean(uidRef.current && getSupabase());
    if (getSupabase() && (signedIn || !readyRef.current)) {
      if (!pending.current.length && !base.current) base.current = docRef.current;
      pending.current.push(fn);
    }
    const next = { ...fn(docRef.current), updatedAt: Date.now() };
    show(next, false);
    writeJSON(o.current.localKey, next);
    if (signedIn) {
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(sync, 700);
    }
  }, [show, sync]);

  // settled: this device is read, sign-in is known, and (when signed in) the account has been checked
  const settled = hydrated && ready && (!uid || !getSupabase() || reached);
  return { doc, update, status: uid ? status : ("device" as SyncStatus), loads, hydrated, settled };
}

export function syncLabel(s: SyncStatus) {
  return s === "saving" ? "Saving…" : s === "saved" ? "Saved to your account" : s === "offline" ? "Saved on this device (offline)" : "Saved on this device";
}
