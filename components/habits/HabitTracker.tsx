"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Chevron } from "@/components/icons";
import { useToast } from "@/components/toast";
import { DEFAULT_HABITS } from "@/lib/habits";
import { HABITS_KEY } from "@/lib/storage";
import { useCloudDoc } from "@/lib/useCloudDoc";
import { useIsClient } from "@/lib/useLocal";

type Habit = { id: string; name: string };
type Notes = { mood: Record<string, number>; motivation: Record<string, number> };
type Doc = { habits: Habit[]; checks: Record<string, string[]>; notes: Record<string, Notes>; updatedAt: number };
type Measure = "mood" | "motivation";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => (n < 10 ? "0" : "") + n;

const habitDoc = {
  localKey: HABITS_KEY,
  empty: (): Doc => ({ habits: DEFAULT_HABITS.map((name, i) => ({ id: "d" + (i + 1), name })), checks: {}, notes: {}, updatedAt: 0 }),
  normalize: (raw: unknown): Doc => {
    const r = (raw || {}) as Partial<Doc>;
    return {
      habits: Array.isArray(r.habits) ? r.habits : DEFAULT_HABITS.map((name, i) => ({ id: "d" + (i + 1), name })),
      checks: r.checks && typeof r.checks === "object" ? r.checks : {},
      notes: r.notes && typeof r.notes === "object" ? r.notes : {},
      updatedAt: Number(r.updatedAt) || 0,
    };
  },
  load: async (sb: SupabaseClient, uid: string): Promise<Doc | null> => {
    const { data, error } = await sb.from("habit_trackers").select("data, updated_at").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    return data ? habitDoc.normalize({ ...(data.data as object), updatedAt: Number(data.updated_at) || 0 }) : null;
  },
  save: async (sb: SupabaseClient, uid: string, d: Doc) => {
    const { updatedAt, ...data } = d;
    const { error } = await sb.from("habit_trackers").upsert({ user_id: uid, data, updated_at: updatedAt });
    if (error) throw error;
  },
};

export function HabitTracker() {
  // dates depend on the visitor's clock, so render in the browser only
  if (!useIsClient()) return <div className="wrap py-16 text-muted">Loading your habits…</div>;
  return <Tracker />;
}

function Tracker() {
  const [now] = useState(() => new Date());
  const toast = useToast();
  const { doc, update } = useCloudDoc<Doc>(habitDoc);
  const H = doc.habits;

  const T0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayYm = now.getFullYear() + "-" + pad(now.getMonth() + 1), todayD = now.getDate();
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth() + 1);
  const ym = vy + "-" + pad(vm);
  const n = new Date(vy, vm, 0).getDate();
  const past = (d: number) => new Date(vy, vm - 1, d) <= T0;
  const isToday = (d: number) => ym === todayYm && d === todayD;

  const monthSet = useMemo(() => new Set(doc.checks[ym] || []), [doc.checks, ym]);
  const todaySet = useMemo(() => new Set(doc.checks[todayYm] || []), [doc.checks, todayYm]);
  const on = (h: string, d: number) => monthSet.has(h + ":" + d);

  const put = (month: string, h: string, d: number, v: boolean) => {
    update((x) => {
      const s = new Set(x.checks[month] || []);
      if (v) s.add(h + ":" + d); else s.delete(h + ":" + d);
      return { ...x, checks: { ...x.checks, [month]: Array.from(s) } };
    });
    if (v && month === todayYm && d === todayD && H.every((h2) => h2.id === h || todaySet.has(h2.id + ":" + d)))
      toast("Every habit done today. Nice work.");
  };

  /* ---------- numbers ---------- */
  const dayPct = (d: number) => (H.length ? H.filter((h) => on(h.id, d)).length / H.length : 0);
  const auto = (type: Measure, d: number) => {
    if (!past(d) || !H.length) return null;
    if (type === "mood") return Math.round(dayPct(d) * 10);
    let s = 0, c = 0;
    for (let i = Math.max(1, d - 2); i <= d; i++) { s += dayPct(i); c++; }
    return Math.round((s / c) * 10);
  };
  const notes = doc.notes[ym] || { mood: {}, motivation: {} };
  const val = (type: Measure, d: number) => {
    const v = notes[type]?.[d];
    return v !== undefined ? +v : auto(type, d);
  };

  let elapsed = 0;
  for (let d = 1; d <= n; d++) if (past(d)) elapsed++;
  const counts = Object.fromEntries(H.map((h) => { let c = 0; for (let d = 1; d <= n; d++) if (on(h.id, d)) c++; return [h.id, c]; }));
  const doneTotal = H.reduce((a, h) => a + counts[h.id], 0);
  const goal = H.length * n, pct = goal ? doneTotal / goal : 0, soFar = H.length * elapsed;
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const pctByDay = days.map(dayPct);
  const best = Math.max(0, ...days.filter(past).map((d) => pctByDay[d - 1]));
  const avg = elapsed ? days.filter(past).reduce((a, d) => a + pctByDay[d - 1], 0) / elapsed : 0;
  const weeks = Math.ceil(n / 7);
  const todayDone = H.filter((h) => todaySet.has(h.id + ":" + todayD)).length;
  const RC = 2 * Math.PI * 64;

  /* ---------- month controls ---------- */
  const shift = (dm: number) => {
    let m = vm + dm, y = vy;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setVm(m); setVy(y);
  };
  const years: number[] = [];
  for (let y = Math.min(2024, vy); y <= Math.max(2032, vy); y++) years.push(y);

  // on narrow screens, scroll the tracker and mood tables so today is in view
  const gridRef = useRef<HTMLTableElement>(null), msRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    [gridRef.current, msRef.current].forEach((t) => {
      if (!t) return;
      const w = t.parentElement!, th = t.querySelector<HTMLElement>("thead th.today"), hc = t.querySelector<HTMLElement>(".hcol");
      w.scrollLeft = th && hc && w.clientWidth ? Math.max(0, th.offsetLeft - hc.offsetWidth - th.offsetWidth * 3) : 0;
    });
  }, [ym, H.length]);

  /* ---------- habit list ---------- */
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(null), 4000); return () => clearTimeout(t); }, [armed]);
  const remove = (h: Habit) => {
    if (armed !== h.id) { setArmed(h.id); return; }
    setArmed(null);
    update((x) => ({
      ...x,
      habits: x.habits.filter((y) => y.id !== h.id),
      checks: Object.fromEntries(Object.entries(x.checks).map(([k, v]) => [k, v.filter((s) => !s.startsWith(h.id + ":"))])),
    }));
    toast("Removed " + h.name);
  };
  const [draft, setDraft] = useState("");
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim().slice(0, 60);
    if (!name) return;
    update((x) => ({ ...x, habits: [...x.habits, { id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name }] }));
    setDraft("");
    toast("Added " + name);
  };

  const setNote = (type: Measure, d: number, raw: string) => {
    let v = raw.replace(/\D/g, "");
    if (v !== "" && +v > 10) v = "10";
    update((x) => {
      const cur = x.notes[ym] || { mood: {}, motivation: {} };
      const o = { ...(cur[type] || {}) };
      if (v === "") delete o[d]; else o[d] = +v;
      return { ...x, notes: { ...x.notes, [ym]: { ...cur, [type]: o } } };
    });
  };

  /* ---------- chart ---------- */
  const W = 1000, CH = 200;
  const yOf = (v: number) => (CH - 6 - (v / 10) * (CH - 12)).toFixed(1);
  const line = (type: Measure) => days.map((d) => { const v = val(type, d); return v === null || isNaN(v) ? null : ((d - 1) / (n - 1) * W).toFixed(1) + "," + yOf(v); }).filter(Boolean).join(" ");

  return (
    <div className="wrap" id="view-habits">
      <section className="h-head">
        <div>
          <h1>Habit tracker</h1>
          <p className="lede">Tick off today’s habits, then watch the month fill in.</p>
        </div>
        <div className="monthnav">
          <button className="iconbtn" type="button" aria-label="Previous month" onClick={() => shift(-1)}><Chevron dir="left" /></button>
          <label className="vh" htmlFor="hMonth">Month</label>
          <select className="sel" id="hMonth" value={vm} onChange={(e) => setVm(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <label className="vh" htmlFor="hYear">Year</label>
          <select className="sel" id="hYear" value={vy} onChange={(e) => setVy(+e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="iconbtn" type="button" aria-label="Next month" onClick={() => shift(1)}><Chevron /></button>
          <button className="btn ghost" type="button" onClick={() => { setVy(now.getFullYear()); setVm(now.getMonth() + 1); }}>This month</button>
        </div>
      </section>

      <div className="h-top">
        <section className="box today" aria-labelledby="tdH">
          <div className="box-h">
            <h2 id="tdH">Today</h2>
            <span className="meta">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
            <span className="meta">{todayDone} of {H.length} done</span>
          </div>
          <div className="tbar"><i style={{ width: (H.length ? (todayDone / H.length) * 100 : 0) + "%" }} /></div>
          {H.length ? (
            <div className="rows">
              {H.map((h) => (
                <label key={h.id} className="row">
                  <input type="checkbox" checked={todaySet.has(h.id + ":" + todayD)} onChange={(e) => put(todayYm, h.id, todayD, e.target.checked)} />
                  <span className="cb"><Check /></span><span className="rl">{h.name}</span>
                </label>
              ))}
            </div>
          ) : <p className="note">Add a habit below to start tracking.</p>}
        </section>
        <section className="score h" aria-live="polite">
          <div className="pring">
            <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
              <circle className="trk" cx="74" cy="74" r="64" fill="none" strokeWidth="12" />
              <circle className="val" cx="74" cy="74" r="64" fill="none" strokeWidth="12" strokeLinecap="round" strokeDasharray={RC.toFixed(2)} strokeDashoffset={(RC * (1 - pct)).toFixed(2)} />
            </svg>
            <div className="c"><b>{Math.floor(pct * 100)}%</b><span>{soFar && elapsed < n ? Math.round((doneTotal / soFar) * 100) + "% of days so far" : "of " + MONTHS[vm - 1]}</span></div>
          </div>
          <dl className="facts">
            <div><dt>Goal</dt><dd>{goal}</dd></div>
            <div><dt>Completed</dt><dd>{doneTotal}</dd></div>
            <div><dt>Left</dt><dd>{goal - doneTotal}</dd></div>
          </dl>
        </section>
      </div>

      <div className="h-charts">
        <section className="box" aria-labelledby="dpH">
          <div className="box-h"><h2 id="dpH">Daily progress</h2><span className="meta">{elapsed ? `Average ${Math.round(avg * 100)}%, best ${Math.round(best * 100)}%` : "Starts on day 1"}</span></div>
          <div className="daily" role="img" aria-label={`Daily completion for ${MONTHS[vm - 1]}: average ${Math.round(avg * 100)} percent`}>
            {days.map((d) => {
              const p = pctByDay[d - 1], f = !past(d);
              return (
                <div key={d} className={"col" + (f ? " future" : "") + (p === 1 ? " full" : "") + (isToday(d) ? " today" : "")} title={`${MONTHS[vm - 1]} ${d}: ${Math.round(p * 100)}%`}>
                  <i style={{ height: (f ? 0 : p * 100) + "%" }} />
                </div>
              );
            })}
          </div>
          <div className="dlabels" aria-hidden="true">{days.map((d) => <span key={d} className={isToday(d) ? "today" : undefined}>{d}</span>)}</div>
        </section>
        <section className="box" aria-labelledby="wpH">
          <div className="box-h"><h2 id="wpH">Weekly progress</h2></div>
          <div className="weekly">
            {Array.from({ length: weeks }, (_, w) => {
              const a = w * 7 + 1, b = Math.min(n, a + 6);
              let c = 0;
              for (let d = a; d <= b; d++) H.forEach((h) => { if (on(h.id, d)) c++; });
              const wp = H.length ? c / (H.length * (b - a + 1)) : 0;
              return (
                <div className="wk" key={w}>
                  <span>Week {w + 1}<small>{a}–{b} {MONTHS[vm - 1].slice(0, 3)}</small></span>
                  <span className="track"><i className={wp === 1 ? "full" : ""} style={{ width: wp * 100 + "%" }} /></span>
                  <b>{Math.round(wp * 100)}%</b>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="box" aria-labelledby="grH" style={{ marginBottom: 16 }}>
        <div className="box-h"><h2 id="grH">Tracker</h2><span className="meta">{MONTHS[vm - 1]} {vy} · {doneTotal} of {goal} ticks</span></div>
        <div className="gridwrap">
          <table className="hgrid" ref={gridRef}>
            <thead>
              <tr className="wrow">
                <th className="hcol" rowSpan={2} scope="col">Habit</th>
                {Array.from({ length: weeks }, (_, w) => <th key={w} className="ws" colSpan={Math.min(7, n - w * 7)} scope="colgroup">Week {w + 1}</th>)}
                <th className="sum" rowSpan={2} scope="col">Done</th>
              </tr>
              <tr>
                {days.map((d) => (
                  <th key={d} scope="col" className={"day" + ((d - 1) % 7 === 0 ? " ws" : "") + (isToday(d) ? " today" : "")}>
                    <span>{d}</span><small>{DOW[new Date(vy, vm - 1, d).getDay()]}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!H.length && <tr><td colSpan={n + 2} style={{ padding: 24, color: "var(--muted)" }}>No habits yet. Add one in My habits.</td></tr>}
              {H.map((h) => (
                <tr key={h.id}>
                  <th className="hcol" scope="row" title={h.name}>{h.name}</th>
                  {days.map((d) => (
                    <td key={d} className={((d - 1) % 7 === 0 ? "ws" : "") + (isToday(d) ? " today" : "")}>
                      <input type="checkbox" className={"hcb" + (past(d) ? "" : " future")} checked={on(h.id, d)}
                        aria-label={`${h.name}, ${MONTHS[vm - 1]} ${d}`} onChange={(e) => put(ym, h.id, d, e.target.checked)} />
                    </td>
                  ))}
                  <td className="sum"><span className="sumc"><b>{counts[h.id]}/{n}</b><span className="mb"><i style={{ width: (counts[h.id] / n) * 100 + "%" }} /></span></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="h-bottom">
        <section className="box" aria-labelledby="msH">
          <div className="box-h"><h2 id="msH">Mental state</h2><span className="meta">0–10 each day</span></div>
          <p className="note" style={{ marginTop: 4 }}>Grey italic numbers are filled in from your tracker. Type a number to set your own, clear it to go back to the automatic one.</p>
          <div className="gridwrap">
            <table className="ms" ref={msRef}>
              <thead>
                <tr>
                  <th className="hcol" scope="col"><span className="vh">Measure</span></th>
                  {days.map((d) => <th key={d} scope="col" className={isToday(d) ? "today" : undefined}><span>{d}</span></th>)}
                </tr>
              </thead>
              <tbody>
                {([["mood", "Mood", "var(--route)"], ["motivation", "Motivation", "var(--warm)"]] as const).map(([type, label, color]) => (
                  <tr key={type} className={type === "mood" ? undefined : "mot"}>
                    <th className="hcol" scope="row"><i style={{ background: color }} />{label}</th>
                    {days.map((d) => {
                      const v = notes[type]?.[d], a = auto(type, d);
                      return (
                        <td key={d} className={isToday(d) ? "today" : undefined}>
                          <input type="text" inputMode="numeric" maxLength={2} aria-label={`${label}, ${MONTHS[vm - 1]} ${d}`}
                            value={v === undefined ? "" : String(v)} placeholder={a === null ? "" : String(a)}
                            onChange={(e) => setNote(type, d, e.target.value)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart">
            <svg viewBox={`0 0 ${W} ${CH}`} preserveAspectRatio="none" role="img" aria-label={`Mood and motivation through ${MONTHS[vm - 1]}`}>
              {[0, 5, 10].map((v) => <line key={v} className="gl" x1="0" x2={W} y1={yOf(v)} y2={yOf(v)} vectorEffect="non-scaling-stroke" />)}
              <polyline className="l2" points={line("motivation")} vectorEffect="non-scaling-stroke" />
              <polyline className="l1" points={line("mood")} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="mlegend"><span><i style={{ background: "var(--route)" }} />Mood</span><span><i style={{ background: "var(--warm)" }} />Motivation</span></div>
        </section>
        <div className="side">
          <section className="box" aria-labelledby="thH">
            <div className="box-h"><h2 id="thH">Top habits</h2><span className="meta">this month</span></div>
            <ol className="toplist">
              {H.length ? [...H].sort((x, y) => counts[y.id] - counts[x.id]).slice(0, 10).map((h, i) => (
                <li key={h.id}>
                  <span className="rk">{i + 1}</span><span className="nm" title={h.name}>{h.name}</span><b>{counts[h.id]}/{n}</b>
                  <span className="mb"><i style={{ width: (counts[h.id] / n) * 100 + "%" }} /></span>
                </li>
              )) : <li><span /><span className="nm" style={{ color: "var(--muted)" }}>No habits yet</span></li>}
            </ol>
          </section>
          <section className="box" aria-labelledby="mhH">
            <div className="box-h"><h2 id="mhH">My habits</h2><span className="meta">{H.length} habits</span></div>
            <ul className="manage">
              {H.length ? H.map((h) => (
                <li key={h.id}>
                  <span title={h.name}>{h.name}</span>
                  <button type="button" className={"rm" + (armed === h.id ? " armed" : "")} aria-label={armed === h.id ? `Confirm removing ${h.name}` : `Remove ${h.name}`} onClick={() => remove(h)}>
                    {armed === h.id ? "Click to confirm" : "Remove"}
                  </button>
                </li>
              )) : <li><span style={{ color: "var(--muted)" }}>No habits yet.</span></li>}
            </ul>
            <form className="addf" onSubmit={add}>
              <label className="vh" htmlFor="hNew">New habit</label>
              <input id="hNew" maxLength={60} placeholder="New habit, emoji welcome" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button className="btn primary" type="submit">Add</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

