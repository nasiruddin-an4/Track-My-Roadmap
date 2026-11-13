import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRoadmap } from "@/content/roadmaps";
import { CATALOG } from "@/lib/catalog";
import { profileOf } from "@/lib/profile";
import { roadmapStat } from "@/lib/progressStats";
import { computeProgress, videoSlots } from "@/lib/roadmap";
import { checkAdmin } from "@/lib/supabase/admin";
import { getServiceSupabase } from "@/lib/supabase/service";

/** Day buckets follow the main audience's clock (Bangladesh). */
export const INSIGHTS_TZ = "Asia/Dhaka";
const DAY = 864e5;
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: INSIGHTS_TZ }).format(ms); // YYYY-MM-DD

export type UserRoadmap = { slug: string; title: string; done: number; total: number; pct: number; complete: boolean; current: string | null; updatedAt: number };
export type InsightUser = {
  id: string; name: string; email: string; avatar: string | null;
  joined: number; lastActive: number | null; lastSignIn: number | null;
  topicsDone: number; certificates: number; habits: boolean;
  roadmaps: UserRoadmap[];
};
export type RoadmapInsight = {
  slug: string; title: string; started: number; completed: number; avgPct: number;
  /** the phase most unfinished learners are on right now */
  stuck: { num: number; title: string; learners: number } | null;
};
export type NeedsVideo = { slug: string; roadmap: string; key: string; topic: string; waiting: number };
export type Insights = {
  generatedAt: number;
  totals: { users: number; new1: number; new7: number; new30: number; active1: number; active7: number; active30: number; topicsDone: number; certificates: number; habitUsers: number };
  signups: { day: string; count: number }[];
  roadmaps: RoadmapInsight[];
  needsVideo: NeedsVideo[];
  users: InsightUser[];
};

export type InsightsResult = { ok: true; data: Insights } | { ok: false; reason: "not-admin" | "no-secret-key" | "error"; message?: string };

const PAGE = 1000;

async function allUsers(sb: SupabaseClient): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; page < 1000; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < PAGE) break;
  }
  return out;
}

async function allRows<T>(sb: SupabaseClient, table: string, cols: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).order(order).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

type ProgressRaw = { user_id: string; roadmap: string; done: string[] | null; updated_at: number | string | null };
type HabitRaw = { user_id: string; updated_at: number | string | null };
type ResourceRaw = { roadmap: string; topic_key: string };

/** Everything the admin overview and users pages show. Checks the visitor is an admin before reading anything. */
export async function adminInsights(): Promise<InsightsResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, reason: "not-admin" };
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, reason: "no-secret-key" };

  try {
    const [users, progress, habits, resources] = await Promise.all([
      allUsers(sb),
      allRows<ProgressRaw>(sb, "roadmap_progress", "user_id, roadmap, done, updated_at", "user_id"),
      allRows<HabitRaw>(sb, "habit_trackers", "user_id, updated_at", "user_id"),
      allRows<ResourceRaw>(sb, "topic_resources", "roadmap, topic_key", "id"),
    ]);
    return { ok: true, data: summarise(users, progress, habits, resources) };
  } catch (e) {
    console.error("admin insights:", e);
    return { ok: false, reason: "error", message: (e as Error)?.message };
  }
}

export function summarise(users: User[], progress: ProgressRaw[], habits: HabitRaw[], resources: ResourceRaw[]): Insights {
  const now = Date.now();
  const catalog = new Map(CATALOG.map((c) => [c.slug, c]));
  const withVideo = new Set(resources.map((r) => r.roadmap + "|" + r.topic_key));

  const byUser = new Map<string, UserRoadmap[]>();
  const lastActive = new Map<string, number>();
  const bump = (id: string, at: number) => { if (at > (lastActive.get(id) ?? 0)) lastActive.set(id, at); };

  const rmAgg = new Map<string, { started: number; completed: number; pctSum: number; stuck: Map<number, number> }>();
  const waiting = new Map<string, NeedsVideo>();

  for (const row of progress) {
    const c = catalog.get(row.roadmap);
    const done = row.done ?? [];
    const updatedAt = Number(row.updated_at) || 0;
    if (!c || !done.length) continue;
    const s = roadmapStat(c, done, updatedAt);
    if (s.done === 0) continue;
    bump(row.user_id, updatedAt);
    const complete = s.total > 0 && s.done === s.total;
    const list = byUser.get(row.user_id) ?? [];
    list.push({ slug: c.slug, title: c.title, done: s.done, total: s.total, pct: s.pct, complete, current: s.current ? `Phase ${s.current.num}: ${s.current.title}` : null, updatedAt });
    byUser.set(row.user_id, list);

    const a = rmAgg.get(c.slug) ?? { started: 0, completed: 0, pctSum: 0, stuck: new Map() };
    a.started++; a.pctSum += s.pct;
    if (complete) a.completed++;
    else if (s.current) a.stuck.set(s.current.num, (a.stuck.get(s.current.num) ?? 0) + 1);
    rmAgg.set(c.slug, a);

    // what this learner should study next, and whether it has a video yet
    const rm = getRoadmap(c.slug);
    if (!rm || complete) continue;
    const next = computeProgress(rm, new Set(done), false).next;
    if (!next || next.pick) continue; // "pick one" choices: no single topic to point at
    const card = rm.cardById[next.cardId];
    const slot = videoSlots(card)[0];
    const key = slot?.whole ? slot.key : next.key;
    const topic = slot?.whole ? card.title : next.label;
    if (withVideo.has(c.slug + "|" + key)) continue;
    const id = c.slug + "|" + key;
    const w = waiting.get(id) ?? { slug: c.slug, roadmap: c.title, key, topic, waiting: 0 };
    w.waiting++;
    waiting.set(id, w);
  }

  const habitUsers = new Set<string>();
  for (const h of habits) { habitUsers.add(h.user_id); bump(h.user_id, Number(h.updated_at) || 0); }

  // sign-ups per day, last 30 days (oldest first)
  const days = Array.from({ length: 30 }, (_, i) => dayKey(now - (29 - i) * DAY));
  const perDay = new Map(days.map((d) => [d, 0]));
  const since = (ms: number, n: number) => now - ms <= n * DAY;

  const list: InsightUser[] = users.map((u) => {
    const p = profileOf(u);
    const joined = Date.parse(u.created_at) || 0;
    const k = dayKey(joined);
    if (perDay.has(k)) perDay.set(k, perDay.get(k)! + 1);
    const rms = (byUser.get(u.id) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      id: u.id, name: p.name, email: p.email, avatar: p.avatar ?? null,
      joined, lastActive: lastActive.get(u.id) ?? null, lastSignIn: u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : null,
      topicsDone: rms.reduce((a, r) => a + r.done, 0), certificates: rms.filter((r) => r.complete).length,
      habits: habitUsers.has(u.id), roadmaps: rms,
    };
  }).sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0) || b.joined - a.joined);

  const roadmaps: RoadmapInsight[] = [...rmAgg.entries()].map(([slug, a]) => {
    const c = catalog.get(slug)!;
    const [num, learners] = [...a.stuck.entries()].sort((x, y) => y[1] - x[1])[0] ?? [];
    const phase = num ? c.phases[num - 1] : undefined;
    return {
      slug, title: c.title, started: a.started, completed: a.completed, avgPct: Math.round(a.pctSum / a.started),
      stuck: num && phase ? { num, title: phase.title, learners: learners! } : null,
    };
  }).sort((a, b) => b.started - a.started || a.title.localeCompare(b.title));

  const active = (n: number) => list.filter((u) => u.lastActive && since(u.lastActive, n)).length;
  return {
    generatedAt: now,
    totals: {
      users: list.length,
      new1: list.filter((u) => since(u.joined, 1)).length,
      new7: list.filter((u) => since(u.joined, 7)).length,
      new30: list.filter((u) => since(u.joined, 30)).length,
      active1: active(1), active7: active(7), active30: active(30),
      topicsDone: list.reduce((a, u) => a + u.topicsDone, 0),
      certificates: list.reduce((a, u) => a + u.certificates, 0),
      habitUsers: habitUsers.size,
    },
    signups: days.map((d) => ({ day: d, count: perDay.get(d) ?? 0 })),
    roadmaps,
    needsVideo: [...waiting.values()].sort((a, b) => b.waiting - a.waiting || a.topic.localeCompare(b.topic)).slice(0, 12),
    users: list,
  };
}
