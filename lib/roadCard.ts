/*
 * Shareable Road Cards (server side only).
 *
 * A card link carries its own data: a small JSON summary plus an HMAC signature made with ROAD_CARD_SECRET.
 * The server builds the summary from the signed-in person's saved progress, so a link can't be edited to
 * show progress someone doesn't have, and nothing new is stored in the database. A link is a snapshot:
 * when progress changes, sharing again makes a new link (which also makes social sites fetch a fresh preview).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRoadmap } from "@/content/roadmaps";
import { CATALOG } from "@/lib/catalog";
import { profileOf } from "@/lib/profile";
import { habitStreaks, roadmapStat, todayAtOffset } from "@/lib/progressStats";

/** The overall card: everything the person is learning. */
export type CardData = {
  v: 1;
  k?: undefined;
  /** name */ n: string;
  /** photo URL (Google) */ a?: string;
  /** joined, "YYYY-MM" */ j?: string;
  /** topics done */ t: number;
  /** roadmaps started */ r: number;
  /** roadmaps completed */ c: number;
  /** habit streak, days */ s: number;
  /** top roadmaps: [slug, percent] */ m: [string, number][];
};

/** One roadmap's card. */
export type RoadmapCardData = {
  v: 1;
  k: "r";
  /** name */ n: string;
  /** photo URL (Google) */ a?: string;
  /** joined, "YYYY-MM" */ j?: string;
  /** roadmap slug */ rm: string;
  /** topics done */ d: number;
  /** topics in the roadmap */ t: number;
  /** one letter per phase: d = done, s = started, u = not started */ ph: string;
};

export type AnyCard = CardData | RoadmapCardData;

export const cardSigningConfigured = () => !!process.env.ROAD_CARD_SECRET;

function sign(body: string): string {
  return createHmac("sha256", process.env.ROAD_CARD_SECRET!).update(body).digest("base64url");
}

export function encodeCard(data: AnyCard): string {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** The card in a token, or null if it was altered, is malformed, or signing isn't set up. */
export function decodeCard(token: string): AnyCard | null {
  if (!cardSigningConfigured() || token.length > 2000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString()) as AnyCard;
    if (d?.v !== 1 || typeof d.n !== "string") return null;
    if (d.k === "r") return typeof d.rm === "string" && typeof d.ph === "string" && getRoadmap(d.rm) ? d : null;
    return Array.isArray(d.m) ? d : null;
  } catch {
    return null;
  }
}

/** Only Google profile photos are drawn into card images. */
export function safeAvatar(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    // Google profile photo hosts only (other googleusercontent.com hosts serve user-uploaded files)
    return u.protocol === "https:" && /^lh[3-6]\.googleusercontent\.com$/.test(u.hostname) ? url.replace(/=s\d+(-c)?$/, "=s256-c") : undefined;
  } catch {
    return undefined;
  }
}

/** One roadmap's card for a signed-in person, from their saved progress (null if the roadmap doesn't exist). */
export async function roadmapCardFor(sb: SupabaseClient, user: User, slug: string): Promise<RoadmapCardData | null> {
  const entry = CATALOG.find((c) => c.slug === slug);
  if (!entry) return null;
  const { data, error } = await sb.from("roadmap_progress").select("done, updated_at").eq("user_id", user.id).eq("roadmap", slug).maybeSingle();
  if (error) throw error;
  const s = roadmapStat(entry, data?.done ?? [], Number(data?.updated_at) || 0);
  const profile = profileOf(user);
  return { v: 1, k: "r", n: profile.name.slice(0, 60), a: safeAvatar(profile.avatar), j: profile.joined?.slice(0, 7), rm: slug, d: s.done, t: s.total, ph: s.phaseStates };
}

/** Build the overall card for a signed-in person from their saved progress. `tzOffset` is their Date.getTimezoneOffset(), for the habit streak. */
export async function cardFor(sb: SupabaseClient, user: User, tzOffset: number): Promise<CardData> {
  const [p, h] = await Promise.all([
    sb.from("roadmap_progress").select("roadmap, done, updated_at").eq("user_id", user.id),
    sb.from("habit_trackers").select("data").eq("user_id", user.id).maybeSingle(),
  ]);
  if (p.error) throw p.error;

  const bySlug = new Map((p.data ?? []).map((r) => [r.roadmap as string, r]));
  const stats = CATALOG.flatMap((c) => {
    const row = bySlug.get(c.slug);
    if (!row?.done?.length) return [];
    const s = roadmapStat(c, row.done, Number(row.updated_at) || 0);
    return s.done > 0 ? [s] : [];
  });
  const top = [...stats].sort((x, y) => y.pct - x.pct || y.updatedAt - x.updatedAt).slice(0, 3);

  const habits = h.data?.data as { habits?: { id: string }[]; checks?: Record<string, string[]> } | undefined;
  const streak = habits?.habits ? habitStreaks({ habits: habits.habits, checks: habits.checks ?? {} }, todayAtOffset(tzOffset)).streak : 0;

  const profile = profileOf(user);
  return {
    v: 1,
    n: profile.name.slice(0, 60),
    a: safeAvatar(profile.avatar),
    j: profile.joined?.slice(0, 7),
    t: stats.reduce((n, s) => n + s.done, 0),
    r: stats.length,
    c: stats.filter((s) => s.pct >= 100).length,
    s: streak,
    m: top.map((s) => [s.slug, s.pct]),
  };
}

/** What a roadmap card shows, worked out from its data. */
export function roadmapCardView(d: RoadmapCardData) {
  const rm = getRoadmap(d.rm)!;
  const pct = d.t ? Math.floor((Math.min(d.d, d.t) / d.t) * 100) : 0;
  const states = d.ph.slice(0, 40).split("").map((c) => (c === "d" ? "done" : c === "s" ? "started" : "todo") as "done" | "started" | "todo");
  const curIdx = states.findIndex((x) => x !== "done");
  return {
    title: rm.def.title,
    category: rm.def.category,
    pct,
    states,
    phasesDone: states.filter((x) => x === "done").length,
    current: curIdx >= 0 && rm.numbered[curIdx] ? { num: curIdx + 1, title: rm.numbered[curIdx].title } : null,
  };
}

/** Roadmap titles for a card's top list (unknown slugs are skipped). */
export function cardRoadmaps(d: CardData): { title: string; pct: number }[] {
  return d.m.flatMap(([slug, pct]) => {
    const rm = getRoadmap(slug);
    return rm ? [{ title: rm.def.title, pct: Math.max(0, Math.min(100, Math.round(pct))) }] : [];
  });
}

export function joinedLabel(j?: string): string {
  if (!j || !/^\d{4}-\d{2}$/.test(j)) return "";
  const [y, m] = j.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" });
}
