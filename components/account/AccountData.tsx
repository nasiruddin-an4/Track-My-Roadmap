"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth";
import { habitSummary, type HabitDoc } from "@/lib/habits";
import { habitStreaks, localToday, roadmapStat, type CatalogEntry, type RoadmapStat } from "@/lib/progressStats";
import { loadAllProgress } from "@/lib/progressRow";
import { profileOf, type Profile } from "@/lib/profile";
import { HABITS_KEY, readJSON } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase/client";

/*
 * Everything the account pages show, worked out in the browser from the signed-in person's saved progress.
 * For each roadmap (and the habit tracker) the newer of the account copy and this device's copy wins,
 * the same rule the trackers use when they sync.
 */

export type { CatalogEntry, RoadmapStat } from "@/lib/progressStats";
export { profileOf, type Profile } from "@/lib/profile";

export type HabitStat = {
  started: boolean;
  today: number;
  total: number;
  /** days in a row (ending today, or yesterday if nothing is ticked yet today) with at least one habit ticked */
  streak: number;
  best: number;
  updatedAt: number;
};

export type AccountData = {
  status: "loading" | "ready";
  /** true if the account copy couldn't be loaded and only this device's progress is shown */
  offline: boolean;
  roadmaps: RoadmapStat[]; // started roadmaps, most recently updated first
  inProgress: RoadmapStat[];
  completed: RoadmapStat[];
  topicsDone: number;
  habits: HabitStat;
  lastActive: number;
  profile: Profile;
};


type Doc = { done: string[]; updatedAt: number; completedAt?: number | null };

/** What pages see before the data is ready, and when rendered without the account layout around them
 *  (Next's instant-navigation check renders a page on its own): the pages show their loading skeleton. */
const LOADING: AccountData = {
  status: "loading",
  offline: false,
  roadmaps: [],
  inProgress: [],
  completed: [],
  topicsDone: 0,
  habits: { started: false, today: 0, total: 0, streak: 0, best: 0, updatedAt: 0 },
  lastActive: 0,
  profile: profileOf(null),
};

const Ctx = createContext<AccountData>(LOADING);

export function useAccount(): AccountData {
  return useContext(Ctx);
}

export function AccountDataProvider({ catalog, children }: { catalog: CatalogEntry[]; children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const uid = user?.id ?? null;
  const [remote, setRemote] = useState<{ uid: string | null; rows: Record<string, Doc>; habits: HabitDoc | null; offline: boolean } | null>(null);
  const [local, setLocal] = useState<{ rows: Record<string, Doc>; habits: HabitDoc | null } | null>(null);

  // this device
  useEffect(() => {
    const rows: Record<string, Doc> = {};
    for (const c of catalog) {
      const d = readJSON<Partial<Doc>>(c.localKey);
      if (d && Array.isArray(d.done)) rows[c.slug] = { done: d.done, updatedAt: Number(d.updatedAt) || 0, completedAt: Number(d.completedAt) || null };
    }
    const h = readJSON<HabitDoc>(HABITS_KEY);
    // read once on mount: localStorage is outside React
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal({ rows, habits: h && Array.isArray(h.habits) ? { ...h, checks: h.checks || {} } : null });
  }, [catalog]);

  // the account
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !uid) return;
    let live = true;
    Promise.all([
      loadAllProgress(sb, uid).then((rows) => ({ rows, error: null }), (error) => ({ rows: {} as Record<string, Doc>, error })),
      sb.from("habit_trackers").select("data, updated_at").eq("user_id", uid).maybeSingle(),
    ]).then(([p, h]) => {
      if (!live) return;
      const rows: Record<string, Doc> = p.rows;
      const hd = h.data ? ({ ...(h.data.data as object), updatedAt: Number(h.data.updated_at) || 0 } as HabitDoc) : null;
      setRemote({ uid, rows, habits: hd && Array.isArray(hd.habits) ? { ...hd, checks: hd.checks || {} } : null, offline: !!(p.error || h.error) });
    }, () => { if (live) setRemote({ uid, rows: {}, habits: null, offline: true }); });
    return () => { live = false; };
  }, [uid]);

  const value = useMemo<AccountData>(() => {
    const needRemote = !!getSupabase() && !!uid;
    const ready = authReady && !!local && (!needRemote || remote?.uid === uid);
    const r = remote?.uid === uid ? remote : null;
    const newer = <T extends { updatedAt: number }>(a: T | null | undefined, b: T | null | undefined) =>
      !a ? b ?? null : !b ? a : a.updatedAt >= b.updatedAt ? a : b;

    const roadmaps: RoadmapStat[] = [];
    for (const c of catalog) {
      const doc = newer(local?.rows[c.slug], r?.rows[c.slug]);
      if (!doc?.done.length) continue;
      const stat = { ...roadmapStat(c, doc.done, doc.updatedAt), completedAt: doc.completedAt ?? null };
      if (stat.done > 0) roadmaps.push(stat);
    }
    roadmaps.sort((a, b) => b.updatedAt - a.updatedAt);
    const habitDoc = newer(local?.habits, r?.habits);
    const habits = habitStat(habitDoc);

    return {
      status: ready ? "ready" : "loading",
      offline: !!r?.offline,
      roadmaps,
      inProgress: roadmaps.filter((s) => s.pct < 100),
      completed: roadmaps.filter((s) => s.pct >= 100),
      topicsDone: roadmaps.reduce((n, s) => n + s.done, 0),
      habits,
      lastActive: Math.max(0, habits.updatedAt, ...roadmaps.map((s) => s.updatedAt)),
      profile: profileOf(user),
    };
  }, [catalog, local, remote, uid, user, authReady]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function habitStat(doc: HabitDoc | null): HabitStat {
  if (!doc || !doc.updatedAt) return { started: false, today: 0, total: 0, streak: 0, best: 0, updatedAt: 0 };
  const { streak, best } = habitStreaks(doc, localToday());
  const sum = habitSummary(doc, new Date());
  return { started: true, today: sum.today, total: sum.total, streak, best, updatedAt: doc.updatedAt };
}

/** "just now", "5 min ago", "3 days ago", or a date. */
export function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
