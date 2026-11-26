/*
 * Progress summaries shared by the account pages (browser) and the shareable Road Card (server),
 * so both show the same numbers.
 */
// relative import, so the unit tests can run this file directly
import { keyHash, PHASE_MARK } from "./roadmap.ts";

/** One roadmap as the summaries need it: hashed progress units per numbered phase (see progressUnitsByPhase). */
export type CatalogEntry = {
  slug: string;
  title: string;
  category: string;
  localKey: string;
  /** `id` matches the learner's "marked complete" entries (see PHASE_MARK) */
  phases: { id: string; title: string; units: string[][] }[];
};

export type RoadmapStat = {
  slug: string;
  title: string;
  category: string;
  /** topics ticked, and the share of all counted topics (what the learner actually ticked) */
  done: number;
  total: number;
  pct: number;
  /** every phase complete (all topics ticked, or marked complete): the roadmap is finished */
  complete: boolean;
  phasesDone: number;
  phaseCount: number;
  /** first phase not yet finished (null when the roadmap is complete) */
  current: { num: number; title: string } | null;
  /** one letter per numbered phase: d = done, s = started, u = not started */
  phaseStates: string;
  updatedAt: number;
  /** when the roadmap was completed, if known (for the certificate date) */
  completedAt?: number | null;
};

export function roadmapStat(c: CatalogEntry, ticked: string[], updatedAt: number): RoadmapStat {
  const done = new Set(ticked.map(keyHash));
  const marked = new Set(ticked.filter((k) => k.startsWith(PHASE_MARK)).map((k) => k.slice(PHASE_MARK.length)));
  let d = 0, t = 0, phasesDone = 0;
  let current: RoadmapStat["current"] = null;
  let phaseStates = "";
  c.phases.forEach((ph, i) => {
    const pd = ph.units.filter((u) => u.some((k) => done.has(k))).length;
    d += pd; t += ph.units.length;
    const full = (ph.units.length > 0 && pd === ph.units.length) || marked.has(ph.id);
    phaseStates += full ? "d" : pd > 0 ? "s" : "u";
    if (full) phasesDone++;
    else if (!current) current = { num: i + 1, title: ph.title };
  });
  return {
    slug: c.slug, title: c.title, category: c.category,
    done: d, total: t, pct: t ? Math.floor((d / t) * 100) : 0,
    complete: c.phases.length > 0 && phasesDone === c.phases.length,
    phasesDone, phaseCount: c.phases.length, current, phaseStates, updatedAt,
  };
}

/* ---------- habit streaks ---------- */

/** A calendar day in the person's own time zone (month 1–12). */
export type Day = { y: number; m: number; d: number };

export function localToday(now = new Date()): Day {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** Today for someone whose clock is `offsetMin` minutes behind UTC (Date.getTimezoneOffset()). */
export function todayAtOffset(offsetMin: number, nowMs = Date.now()): Day {
  const t = new Date(nowMs - offsetMin * 60_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const dayKey = (ms: number) => {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

/** Current and best run of days with at least one habit ticked. The current run may end yesterday if today has no ticks yet. */
export function habitStreaks(doc: { habits: { id: string }[]; checks: Record<string, string[]> }, today: Day): { streak: number; best: number } {
  const ids = new Set(doc.habits.map((h) => h.id));
  const days = new Set<string>();
  for (const [mk, list] of Object.entries(doc.checks || {}))
    for (const t of list || []) {
      const [id, dd] = String(t).split(":");
      if (ids.has(id) && dd) days.add(`${mk}-${dd.padStart(2, "0")}`);
    }

  let ms = Date.UTC(today.y, today.m - 1, today.d);
  if (!days.has(dayKey(ms))) ms -= 864e5;
  let streak = 0;
  while (days.has(dayKey(ms)) && streak < 3660) { streak++; ms -= 864e5; }

  let best = 0, run = 0, prev = 0;
  for (const s of [...days].sort()) {
    const [y, m, d] = s.split("-").map(Number);
    const cur = Date.UTC(y, m - 1, d);
    run = prev && Math.round((cur - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return { streak, best: Math.max(best, streak) };
}
