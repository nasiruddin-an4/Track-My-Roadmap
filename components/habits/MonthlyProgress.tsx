"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth";
import { DEFAULT_HABITS, monthKey, type HabitDoc } from "@/lib/habits";
import { HABITS_KEY } from "@/lib/storage";
import { useIsClient, useLocalItem } from "@/lib/useLocal";

/*
 * The month at a glance: a calendar where each day is shaded by how many habits were done,
 * plus streak and completion numbers. Signed-in people with data see their own month;
 * everyone else sees a clearly labelled example.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ON_TRACK = 0.5; // a day counts towards the streak when at least half the habits are done

type Month = {
  year: number; month: number; days: number; today: number; firstDow: number;
  pct: number[];            // per day 1..days (index 0 = day 1), 0..1
  habits: number;
  top: { name: string; count: number }[];
};

function fromDoc(doc: HabitDoc, now: Date): Month {
  const y = now.getFullYear(), m = now.getMonth(), days = new Date(y, m + 1, 0).getDate();
  const ids = new Set(doc.habits.map((h) => h.id));
  const perDay = new Array(days).fill(0), perHabit: Record<string, number> = {};
  for (const t of doc.checks[monthKey(now)] || []) {
    const [id, d] = t.split(":");
    if (!ids.has(id) || +d < 1 || +d > days) continue;
    perDay[+d - 1]++;
    perHabit[id] = (perHabit[id] || 0) + 1;
  }
  const n = doc.habits.length;
  return {
    year: y, month: m, days, today: now.getDate(), firstDow: new Date(y, m, 1).getDay(), habits: n,
    pct: perDay.map((c) => (n ? c / n : 0)),
    top: doc.habits.map((h) => ({ name: h.name, count: perHabit[h.id] || 0 })).sort((a, b) => b.count - a.count).slice(0, 3),
  };
}

/** A believable month for the example: mostly good days, a few dips, nothing in the future.
 *  Early in a month there is little to show, so the example uses last month, complete. */
function example(now: Date): Month {
  const early = now.getDate() < 8;
  const base = early ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : now;
  const y = base.getFullYear(), m = base.getMonth(), days = new Date(y, m + 1, 0).getDate(), today = early ? days : now.getDate();
  const shape = [1, .83, 1, .67, .94, 1, .5, .89, 1, 1, .72, .28, .9, 1, .78, 1, 1, .61, .94, 1, .83, 1, .56, 1, .89, 1, 1, .72, .94, 1, .83];
  const pct = Array.from({ length: days }, (_, i) => (i + 1 <= today ? shape[i % shape.length] : 0));
  const done = Math.round(pct.reduce((a, b) => a + b, 0));
  return {
    year: y, month: m, days, today, firstDow: new Date(y, m, 1).getDay(), habits: DEFAULT_HABITS.length, pct,
    top: [
      { name: DEFAULT_HABITS[7], count: Math.max(0, today - 1) },
      { name: DEFAULT_HABITS[1], count: Math.max(0, Math.min(today - 2, done)) },
      { name: DEFAULT_HABITS[14], count: Math.max(0, today - 3) },
    ],
  };
}

function stats(mo: Month) {
  const past = mo.pct.slice(0, mo.today);
  const avg = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  const perfect = past.filter((p) => p === 1).length;
  // streak: days in a row at or above ON_TRACK, ending today (or yesterday if today isn't there yet)
  let i = mo.today - 1;
  if (i >= 0 && past[i] < ON_TRACK) i--;
  let streak = 0;
  while (i >= 0 && past[i] >= ON_TRACK) { streak++; i--; }
  const todayDone = Math.round((past[mo.today - 1] || 0) * mo.habits);
  return { avg, perfect, streak, todayDone };
}

function level(p: number, future: boolean) {
  if (future) return "border border-dashed border-line bg-transparent text-muted/50";
  if (p === 1) return "bg-done text-bg";
  if (p >= 0.67) return "bg-route text-route-ink";
  if (p >= 0.34) return "bg-[color-mix(in_srgb,var(--route)_55%,var(--sunk))] text-ink";
  if (p > 0) return "bg-[color-mix(in_srgb,var(--route)_25%,var(--sunk))] text-ink";
  return "bg-sunk text-muted";
}

export function MonthlyProgress() {
  const client = useIsClient();
  const { user, configured } = useAuth();
  const raw = useLocalItem(HABITS_KEY);

  const view = useMemo(() => {
    if (!client) return null;
    const now = new Date();
    if (!configured || user) {
      try {
        const d = raw ? (JSON.parse(raw) as HabitDoc) : null;
        if (d && Array.isArray(d.habits) && d.habits.length && d.updatedAt) return { mine: true, mo: fromDoc({ ...d, checks: d.checks || {} }, now) };
      } catch {}
    }
    return { mine: false, mo: example(now) };
  }, [client, raw, user, configured]);

  if (!view) return <div className="h-[520px] rounded-[24px] border border-line bg-surface" aria-hidden="true" />;
  const { mine, mo } = view;
  const s = stats(mo);
  const cells: (number | null)[] = [...Array(mo.firstDow).fill(null), ...Array.from({ length: mo.days }, (_, i) => i + 1)];

  return (
    <div className="grid gap-8 rounded-[24px] border border-line bg-surface p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
      {/* numbers */}
      <div className="grid content-start gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={"rounded-full px-3 py-1 text-[.78rem] font-semibold " + (mine ? "bg-done-soft text-done" : "bg-sunk text-muted")}>
            {mine ? "Your month" : "Example month"}
          </span>
          <span className="font-display text-[1.05rem] font-semibold">{MONTHS[mo.month]} {mo.year}</span>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <Tile n={`${Math.round(s.avg * 100)}%`} l="of habits done this month" />
          <Tile n={`${s.streak}`} unit={s.streak === 1 ? "day" : "days"} l="streak, at least half your habits each day" accent />
          <Tile n={`${s.perfect}`} unit={s.perfect === 1 ? "day" : "days"} l="with every habit done" />
          <Tile n={`${s.todayDone}/${mo.habits}`} l="habits done today" />
        </dl>
        <div className="grid gap-3">
          <span className="eyebrow">Best habits this month</span>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {mo.top.map((h) => (
              <li key={h.name} className="grid gap-1.5">
                <div className="flex justify-between gap-3 text-[.92rem]">
                  <span className="truncate">{h.name}</span>
                  <span className="font-mono text-[.82rem] text-muted">{h.count}/{mo.today}</span>
                </div>
                <span className="block h-1.5 overflow-hidden rounded-full bg-sunk"><i className="block h-full rounded-full bg-done" style={{ width: Math.min(100, (h.count / Math.max(1, mo.today)) * 100) + "%" }} /></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* calendar (first on phones, where it's the eye-catcher) */}
      <div className="order-first grid content-start gap-3 lg:order-none">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="img"
          aria-label={`${MONTHS[mo.month]} calendar: ${s.perfect} perfect days, ${Math.round(s.avg * 100)} percent of habits done so far`}>
          {DOW.map((d) => (
            <span key={d} className="pb-1 text-center font-mono text-[.7rem] tracking-wide text-muted uppercase" aria-hidden="true">
              <span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span>
            </span>
          ))}
          {cells.map((d, i) =>
            d === null ? <span key={"e" + i} aria-hidden="true" /> : (
              <span key={d} aria-hidden="true"
                className={"relative grid aspect-square place-items-center rounded-[10px] font-mono text-[.78rem] font-medium sm:text-[.85rem] " +
                  level(mo.pct[d - 1], d > mo.today) + (d === mo.today ? " ring-2 ring-ink ring-offset-2 ring-offset-surface" : "")}>
                {d}
              </span>
            ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[.82rem] text-muted">
          <span className="inline-flex items-center gap-1.5">
            Less
            {[0, 0.2, 0.5, 0.8, 1].map((p) => <i key={p} className={"inline-block size-3.5 rounded-[4px] " + level(p, false)} />)}
            More
          </span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-[4px] bg-done" />Every habit done</span>
        </div>
      </div>
    </div>
  );
}

function Tile({ n, unit, l, accent }: { n: string; unit?: string; l: string; accent?: boolean }) {
  return (
    <div className={"grid content-start gap-1 rounded-[16px] p-4 " + (accent ? "bg-route-soft" : "bg-bg")}>
      <dt className="order-2 text-[.82rem] leading-snug text-muted">{l}</dt>
      <dd className="order-1 m-0 flex items-baseline gap-1.5 font-display">
        <span className={"text-[1.9rem] leading-none font-bold tracking-[-.03em] tabular-nums " + (accent ? "text-route" : "")}>{n}</span>
        {unit && <span className="text-[.9rem] font-semibold text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
