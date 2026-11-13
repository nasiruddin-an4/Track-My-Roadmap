"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { getSupabase } from "@/lib/supabase/client";
import { readJSON, writeJSON } from "@/lib/storage";

export type SyncStatus = "device" | "saving" | "saved" | "offline";
type Doc = { updatedAt: number };

export type CloudDocOptions<T extends Doc> = {
  localKey: string;
  empty: () => T;
  normalize: (raw: unknown) => T;
  load: (sb: SupabaseClient, uid: string) => Promise<T | null>;
  save: (sb: SupabaseClient, uid: string, doc: T) => Promise<void>;
};

/*
 * A document kept in this browser and mirrored to the signed-in account.
 * Whichever copy was changed last wins (no merging), same as the original site.
 * `loads` goes up whenever the document is replaced from storage rather than edited here.
 */
export function useCloudDoc<T extends Doc>(opts: CloudDocOptions<T>) {
  const { user } = useAuth();
  const o = useRef(opts);

  const [doc, setDoc] = useState<T>(opts.empty);
  const [hydrated, setHydrated] = useState(false);
  const [loads, setLoads] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("device");
  const docRef = useRef(doc);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const uid = user?.id ?? null;
  const uidRef = useRef(uid);
  useLayoutEffect(() => { o.current = opts; uidRef.current = uid; });

  const replace = useCallback((d: T) => {
    docRef.current = d;
    setDoc(d);
    setLoads((n) => n + 1);
  }, []);

  // 1. this device
  useEffect(() => {
    const raw = readJSON<unknown>(o.current.localKey);
    if (raw) replace(o.current.normalize(raw));
    else setLoads((n) => n + 1);
    setHydrated(true);
  }, [replace]);

  const push = useCallback(() => {
    const sb = getSupabase(), id = uidRef.current;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!sb || !id) return;
    const snapshot = docRef.current;
    setStatus("saving");
    chain.current = chain.current
      .then(() => o.current.save(sb, id, snapshot))
      .then(() => setStatus("saved"), () => setStatus("offline"));
  }, []);

  // 2. the account
  useEffect(() => {
    const sb = getSupabase();
    if (!hydrated || !uid || !sb) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await o.current.load(sb, uid);
        if (cancelled) return;
        const local = docRef.current;
        if (remote && remote.updatedAt > local.updatedAt) {
          writeJSON(o.current.localKey, remote);
          replace(remote);
          setStatus("saved");
        } else if (local.updatedAt > (remote?.updatedAt ?? 0)) push();
        else setStatus("saved");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, uid, push, replace]);

  // save soon after a change; flush straight away if the page is being hidden
  useEffect(() => {
    const flush = () => { if (document.visibilityState === "hidden" && timer.current) push(); };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [push]);

  const update = useCallback((fn: (d: T) => T) => {
    const next = { ...fn(docRef.current), updatedAt: Date.now() };
    docRef.current = next;
    setDoc(next);
    writeJSON(o.current.localKey, next);
    if (uidRef.current && getSupabase()) {
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, 700);
    }
  }, [push]);

  return { doc, update, status: uid ? status : ("device" as SyncStatus), loads, hydrated };
}

export function syncLabel(s: SyncStatus) {
  return s === "saving" ? "Saving…" : s === "saved" ? "Saved to your account" : s === "offline" ? "Saved on this device (offline)" : "Saved on this device";
}
