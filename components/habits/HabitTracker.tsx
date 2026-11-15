"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Chevron, Close } from "@/components/icons";
import { useToast } from "@/components/toast";
import { DEFAULT_HABITS, HABIT_SUGGESTIONS, habitSummary } from "@/lib/habits";
import { HABITS_KEY } from "@/lib/storage";
import { useCloudDoc } from "@/lib/useCloudDoc";
import { useIsClient } from "@/lib/useLocal";

type Habit = { id: string; name: string };
type Notes = { mood: Record<string, number>; motivation: Record<string, number> };
/** setupDone: the first-visit "choose your habits" step is finished. */
type Doc = { habits: Habit[]; checks: Record<string, string[]>; notes: Record<string, Notes>; setupDone: boolean; updatedAt: number };
type Measure = "mood" | "motivation";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => (n < 10 ? "0" : "") + n;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthOf = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1);

/** One-tap check-in: five faces stored on the existing 0–10 scale (2, 4, 6, 8, 10). */
const CHECKIN: Record<Measure, { label: string; faces: [string, string][] }> = {
  mood: { label: "Mood", faces: [["😞", "Very low"], ["😕", "Low"], ["😐", "Okay"], ["🙂", "Good"], ["😄", "Great"]] },
  motivation: { label: "Motivation", faces: [["🪫", "Drained"], ["🥱", "Low"], ["😐", "Okay"], ["💪", "Driven"], ["🚀", "Unstoppable"]] },
};

const habitDoc = {
  localKey: HABITS_KEY,
  empty: (): Doc => ({ habits: DEFAULT_HABITS.map((name, i) => ({ id: "d" + (i + 1), name })), checks: {}, notes: {}, setupDone: false, updatedAt: 0 }),
  normalize: (raw: unknown): Doc => {
    const r = (raw || {}) as Partial<Doc>;
    return {
      habits: Array.isArray(r.habits) ? r.habits : DEFAULT_HABITS.map((name, i) => ({ id: "d" + (i + 1), name })),
      checks: r.checks && typeof r.checks === "object" ? r.checks : {},
      notes: r.notes && typeof r.notes === "object" ? r.notes : {},
      setupDone: !!r.setupDone,
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
  const [now, setNow] = useState(() => new Date());
  // keep "today" current: a tab left open overnight (common on phones) must tick today, not the day it opened
  useEffect(() => {
    const check = () => setNow((prev) => (new Date().toDateString() === prev.toDateString() ? prev : new Date()));
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - Date.now();
    const t = setTimeout(check, midnight + 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [now]);
  const toast = useToast();
  const { doc, update, settled } = useCloudDoc<Doc>(habitDoc);
  const H = doc.habits;

  const T0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayYm = monthOf(now), todayD = now.getDate();

  /* ---------- ticks, for any date ---------- */
  const sets = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(doc.checks)) m[k] = new Set(v);
    return m;
  }, [doc.checks]);
  const has = (date: Date, hid: string) => !!sets[monthOf(date)]?.has(hid + ":" + date.getDate());
  const doneOn = (date: Date) => H.filter((h) => has(date, h.id)).length;
  const fracOn = (date: Date) => (H.length ? doneOn(date) / H.length : 0);

  const put = (date: Date, hid: string, v: boolean) => {
    const month = monthOf(date), d = date.getDate();
    update((x) => {
      const s = new Set(x.checks[month] || []);
      if (v) s.add(hid + ":" + d); else s.delete(hid + ":" + d);
      return { ...x, checks: { ...x.checks, [month]: Array.from(s) } };
    });
    if (v && H.length && H.every((h) => h.id === hid || has(date, h.id)))
      toast(date.getTime() === T0.getTime() ? "Every habit done today. Nice work." : "Every habit done for that day.");
  };

  /** Days in a row a habit was done, ending today (or yesterday, so an unticked today doesn't break it yet). */
  const streak = (hid: string) => {
    let d = has(T0, hid) ? T0 : addDays(T0, -1), c = 0;
    while (c < 3660 && has(d, hid)) { c++; d = addDays(d, -1); }
    return c;
  };
  const streaks: Record<string, number> = Object.fromEntries(H.map((h) => [h.id, streak(h.id)]));
  const topStreak = H.reduce((b, h) => (streaks[h.id] > b.n ? { n: streaks[h.id], name: h.name } : b), { n: 0, name: "" });

  /* ---------- the day being ticked (today or one of the last 6 days) ---------- */
  const [sel, setSel] = useState(0);
  const selDate = addDays(T0, -sel);
  const selDone = doneOn(selDate), selFrac = fracOn(selDate);
  const selTitle = sel === 0 ? "Today" : sel === 1 ? "Yesterday" : selDate.toLocaleDateString("en-GB", { weekday: "long" });
  const [hideDone, setHideDone] = useState(false);
  const shown = hideDone ? H.filter((h) => !has(selDate, h.id)) : H;

  /* ---------- this month, for the summary card ---------- */
  const sum = habitSummary(doc, now);
  const monthSoFar = sum.soFar ? sum.month / sum.soFar : 0;
  let perfectDays = 0;
  if (H.length) for (let d = 1; d <= todayD; d++) if (fracOn(new Date(now.getFullYear(), now.getMonth(), d)) === 1) perfectDays++;

  /* ---------- the month being viewed (charts, tracker grid, mental state) ---------- */
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth() + 1);
  const ym = vy + "-" + pad(vm);
  const n = new Date(vy, vm, 0).getDate();
  const dateIn = (d: number) => new Date(vy, vm - 1, d);
  const past = (d: number) => dateIn(d) <= T0;
  const isToday = (d: number) => ym === todayYm && d === todayD;
  const isThisMonth = ym === todayYm;
  const on = (h: string, d: number) => !!sets[ym]?.has(h + ":" + d);

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
  const goal = H.length * n;
  const days = Array.from({ length: n }, (_, i) => i + 1);
  const pctByDay = days.map(dayPct);
  const best = Math.max(0, ...days.filter(past).map((d) => pctByDay[d - 1]));
  const avg = elapsed ? days.filter(past).reduce((a, d) => a + pctByDay[d - 1], 0) / elapsed : 0;
  const weeks = Math.ceil(n / 7);
  const RC = 2 * Math.PI * 64;

  const shift = (dm: number) => {
    let m = vm + dm, y = vy;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setVm(m); setVy(y);
  };

  // on narrow screens, scroll the tracker and mood tables so today is in view
  const gridRef = useRef<HTMLTableElement>(null), msRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    [gridRef.current, msRef.current].forEach((t) => {
      if (!t) return;
      const w = t.parentElement!, th = t.querySelector<HTMLElement>("thead th.today"), hc = t.querySelector<HTMLElement>(".hcol");
      w.scrollLeft = th && hc && w.clientWidth ? Math.max(0, th.offsetLeft - hc.offsetWidth - th.offsetWidth * 3) : 0;
    });
  }, [ym, H.length]);

  /* ---------- mood and motivation ---------- */
  const setNote = (month: string, type: Measure, d: number, v: number | null) => {
    update((x) => {
      const cur = x.notes[month] || { mood: {}, motivation: {} };
      const o = { ...(cur[type] || {}) };
      if (v === null) delete o[d]; else o[d] = v;
      return { ...x, notes: { ...x.notes, [month]: { ...cur, [type]: o } } };
    });
  };
  const typed = (raw: string) => {
    const v = raw.replace(/\D/g, "");
    return v === "" ? null : Math.min(10, +v);
  };
  const selNote = (type: Measure) => doc.notes[monthOf(selDate)]?.[type]?.[selDate.getDate()];

  /* ---------- habit list ---------- */
  const remove = (h: Habit, quiet = false) => {
    const at = H.findIndex((y) => y.id === h.id);
    const removed: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(doc.checks)) {
      const r = v.filter((s) => s.startsWith(h.id + ":"));
      if (r.length) removed[k] = r;
    }
    update((x) => ({
      ...x,
      habits: x.habits.filter((y) => y.id !== h.id),
      checks: Object.fromEntries(Object.entries(x.checks).map(([k, v]) => [k, v.filter((s) => !s.startsWith(h.id + ":"))])),
    }));
    if (quiet) return;
    toast("Removed " + h.name, {
      label: "Undo",
      run: () => update((x) => {
        if (x.habits.some((y) => y.id === h.id)) return x;
        const checks = { ...x.checks };
        for (const [k, r] of Object.entries(removed)) checks[k] = Array.from(new Set([...(checks[k] || []), ...r]));
        return { ...x, habits: [...x.habits.slice(0, at), h, ...x.habits.slice(at)], checks };
      }),
    });
  };
  const move = (id: string, dir: -1 | 1) => update((x) => {
    const a = [...x.habits], i = a.findIndex((y) => y.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return x;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...x, habits: a };
  });
  const rename = (id: string, raw: string) => {
    const name = raw.trim().slice(0, 60);
    if (name && name !== H.find((h) => h.id === id)?.name)
      update((x) => ({ ...x, habits: x.habits.map((h) => (h.id === id ? { ...h, name } : h)) }));
  };
  const addHabit = (raw: string, quiet = false) => {
    const name = raw.trim().slice(0, 60);
    if (!name) return;
    // the id is made here, not inside the edit: edits can be replayed when syncing, and must give the same result
    const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    update((x) => (x.habits.some((y) => y.id === id) ? x : { ...x, habits: [...x.habits, { id, name }] }));
    if (!quiet) toast("Added " + name);
  };

  /* ---------- first visit: choose habits before tracking ---------- */
  const noTicks = !Object.values(doc.checks).some((a) => a.length);
  const inSetup = !doc.setupDone && noTicks;
  const finishSetup = () => {
    update((x) => ({ ...x, setupDone: true }));
    setSel(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("You’re set. Tick your first habit today.");
  };
  const [editList, setEditList] = useState(false);
  const editorProps = { habits: H, onAdd: addHabit, onRemove: remove, onMove: move, onRename: rename };

  /* ---------- chart ---------- */
  const W = 1000, CH = 200;
  const yOf = (v: number) => (CH - 6 - (v / 10) * (CH - 12)).toFixed(1);
  const line = (type: Measure) => days.map((d) => { const v = val(type, d); return v === null || isNaN(v) ? null : ((d - 1) / (n - 1) * W).toFixed(1) + "," + yOf(v); }).filter(Boolean).join(" ");

  // new visitor, or a new device still checking the account: wait rather than flash the wrong screen
  if (inSetup && !settled) return <div className="wrap py-16 text-muted">Loading your habits…</div>;

  if (inSetup) return (
    <div className="wrap" id="view-habits">
      <section className="h-head">
        <div>
          <h1>Set up your habits</h1>
          <p className="lede">Choose what you want to do every day. It takes a minute, and you can change it anytime.</p>
        </div>
      </section>
      <ol className="steps" aria-label="Getting started">
        <li className="on"><b>1</b>Choose your habits</li>
        <li><b>2</b>Tick them off each day</li>
        <li><b>3</b>Watch your streaks grow</li>
      </ol>
      <section className="box setup" aria-labelledby="suH">
        <h2 id="suH" className="vh">Choose your habits</h2>
        <HabitEditor {...editorProps} setup onClear={() => update((x) => ({ ...x, habits: [] }))} />
        <div className="setup-f">
          <p>{H.length ? <><b>{H.length} habits</b> chosen. {H.length > 10 ? "Tip: fewer habits are easier to keep. You can add more later." : "A good start."}</> : "Pick at least one habit to start."}</p>
          <button type="button" className="btn primary big" disabled={!H.length} onClick={finishSetup}>Start tracking →</button>
        </div>
      </section>
    </div>
  );

  return (
    <div className="wrap" id="view-habits">
      <section className="h-head">
        <div>
          <h1>Habit tracker</h1>
          <p className="lede">Tick off today’s habits, keep your streaks alive, and watch the month fill in.</p>
        </div>
      </section>

      <div className={"h-top" + (editList ? " editing" : "")}>
        <section className="box today" aria-labelledby="tdH">
          <div className="box-h">
            <h2 id="tdH">{editList ? "Edit your habits" : selTitle}</h2>
            {!editList && <span className="meta">{selDate.toLocaleDateString("en-GB", { weekday: sel > 1 ? undefined : "long", day: "numeric", month: "long" })}</span>}
            <button type="button" className={"editbtn" + (editList ? " on" : "")} aria-expanded={editList} onClick={() => setEditList((v) => !v)}>
              {editList ? "Done" : "✎ Edit habits"}
            </button>
          </div>
          {editList ? <HabitEditor {...editorProps} /> : <>

          <div className="wstrip" role="group" aria-label="Choose the day to tick">
            {[6, 5, 4, 3, 2, 1, 0].map((off) => {
              const dt = addDays(T0, -off), f = fracOn(dt);
              return (
                <button key={off} type="button" className={"wd" + (off === sel ? " on" : "") + (f === 1 ? " full" : "")} aria-pressed={off === sel}
                  aria-label={`${dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}: ${Math.round(f * 100)}% done`}
                  onClick={() => setSel(off)}>
                  <small>{off === 0 ? "Today" : dt.toLocaleDateString("en-GB", { weekday: "short" })}</small>
                  <b>{dt.getDate()}</b>
                  <span className="wf"><i style={{ width: f * 100 + "%" }} /></span>
                </button>
              );
            })}
          </div>

          <div className="tline">
            <div className="tbar"><i style={{ width: selFrac * 100 + "%" }} /></div>
            <span className="meta">{selDone} of {H.length} done</span>
            {H.length > 0 && (
              <button type="button" className="tgl" aria-pressed={hideDone} onClick={() => setHideDone((v) => !v)}>
                {hideDone ? "Show all" : "Hide done"}
              </button>
            )}
          </div>

          {!H.length ? (
            <p className="note">You have no habits yet. <button type="button" className="linkbtn" onClick={() => setEditList(true)}>Add your habits</button></p>
          ) : !shown.length ? (
            <p className="alldone">🎉 Everything done for {sel === 0 ? "today" : "this day"}. <button type="button" onClick={() => setHideDone(false)}>Show the list</button></p>
          ) : (
            <div className="rows">
              {shown.map((h) => {
                const s = streaks[h.id];
                return (
                  <label key={h.id} className="row">
                    <input type="checkbox" checked={has(selDate, h.id)} onChange={(e) => put(selDate, h.id, e.target.checked)} />
                    <span className="cb"><Check /></span><span className="rl">{h.name}</span>
                    {s >= 2 && <span className="stk" title={`${s} days in a row`} aria-label={`${s}-day streak`}>🔥 {s}</span>}
                  </label>
                );
              })}
            </div>
          )}
          {sel > 0 && <button type="button" className="back-today" onClick={() => setSel(0)}>← Back to today</button>}
          </>}
        </section>

        {!editList && <section className="score h" aria-live="polite">
          <div className="pring">
            <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
              <circle className="trk" cx="74" cy="74" r="64" fill="none" strokeWidth="12" />
              <circle className="val" cx="74" cy="74" r="64" fill="none" strokeWidth="12" strokeLinecap="round" strokeDasharray={RC.toFixed(2)} strokeDashoffset={(RC * (1 - selFrac)).toFixed(2)} />
            </svg>
            <div className="c"><b>{Math.round(selFrac * 100)}%</b><span>{sel === 0 ? "done today" : "done " + selTitle.toLowerCase()}</span></div>
          </div>
          <dl className="facts">
            <div><dt>{MONTHS[now.getMonth()]} so far</dt><dd>{Math.round(monthSoFar * 100)}%</dd></div>
            <div><dt>Perfect days</dt><dd>{perfectDays}</dd></div>
            <div>
              <dt>Best streak</dt>
              <dd>{topStreak.n ? `🔥 ${topStreak.n} day${topStreak.n > 1 ? "s" : ""}` : "None yet"}{topStreak.n > 0 && <small title={topStreak.name}>{topStreak.name}</small>}</dd>
            </div>
          </dl>
          <div className="checkin">
            <p className="ci-h">How {sel === 0 ? "are you feeling today" : "did you feel " + (sel === 1 ? "yesterday" : "that day")}?</p>
            {(Object.keys(CHECKIN) as Measure[]).map((type) => {
              const cur = selNote(type), pick = cur === undefined ? -1 : Math.max(0, Math.round(cur / 2) - 1);
              return (
                <div key={type} className="emo" role="group" aria-label={CHECKIN[type].label}>
                  <span className="emo-l">{CHECKIN[type].label}</span>
                  {CHECKIN[type].faces.map(([face, label], i) => (
                    <button key={i} type="button" title={label} aria-label={`${CHECKIN[type].label}: ${label}`} aria-pressed={pick === i}
                      onClick={() => setNote(monthOf(selDate), type, selDate.getDate(), pick === i ? null : (i + 1) * 2)}>
                      {face}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>}
      </div>

      <div className="h-month">
        <div>
          <span className="eyebrow">Monthly view</span>
          <h2>{MONTHS[vm - 1]} {vy}</h2>
        </div>
        <div className="monthnav">
          <button className="iconbtn" type="button" aria-label="Previous month" onClick={() => shift(-1)}><Chevron dir="left" /></button>
          <button className="iconbtn" type="button" aria-label="Next month" onClick={() => shift(1)}><Chevron /></button>
          {!isThisMonth && <button className="btn ghost" type="button" onClick={() => { setVy(now.getFullYear()); setVm(now.getMonth() + 1); }}>This month</button>}
        </div>
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
                    <span>{d}</span><small>{DOW[dateIn(d).getDay()]}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!H.length && <tr><td colSpan={n + 2} style={{ padding: 24, color: "var(--muted)" }}>No habits yet. Use Edit habits at the top to add some.</td></tr>}
              {H.map((h) => (
                <tr key={h.id}>
                  <th className="hcol" scope="row" title={h.name}>{h.name}</th>
                  {days.map((d) => (
                    <td key={d} className={((d - 1) % 7 === 0 ? "ws" : "") + (isToday(d) ? " today" : "")}>
                      <input type="checkbox" className={"hcb" + (past(d) ? "" : " future")} checked={on(h.id, d)} disabled={!past(d)}
                        aria-label={`${h.name}, ${MONTHS[vm - 1]} ${d}`} onChange={(e) => put(dateIn(d), h.id, e.target.checked)} />
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
          <div className="chart">
            <svg viewBox={`0 0 ${W} ${CH}`} preserveAspectRatio="none" role="img" aria-label={`Mood and motivation through ${MONTHS[vm - 1]}`}>
              {[0, 5, 10].map((v) => <line key={v} className="gl" x1="0" x2={W} y1={yOf(v)} y2={yOf(v)} vectorEffect="non-scaling-stroke" />)}
              <polyline className="l2" points={line("motivation")} vectorEffect="non-scaling-stroke" />
              <polyline className="l1" points={line("mood")} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="mlegend"><span><i style={{ background: "var(--route)" }} />Mood</span><span><i style={{ background: "var(--warm)" }} />Motivation</span></div>
          <details className="msd">
            <summary>Edit day by day</summary>
            <p className="note" style={{ marginTop: 8 }}>Grey italic numbers are filled in from your tracker. Type a number to set your own, clear it to go back to the automatic one. The check-in at the top sets today’s in one tap.</p>
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
                              onChange={(e) => setNote(ym, type, d, typed(e.target.value))} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <div className="side">
          <section className="box" aria-labelledby="thH">
            <div className="box-h"><h2 id="thH">Top habits</h2><span className="meta">{MONTHS[vm - 1]}</span></div>
            <ol className="toplist">
              {H.length ? [...H].sort((x, y) => counts[y.id] - counts[x.id]).slice(0, 10).map((h, i) => (
                <li key={h.id}>
                  <span className="rk">{i + 1}</span><span className="nm" title={h.name}>{h.name}</span><b>{counts[h.id]}/{n}</b>
                  <span className="mb"><i style={{ width: (counts[h.id] / n) * 100 + "%" }} /></span>
                </li>
              )) : <li><span /><span className="nm" style={{ color: "var(--muted)" }}>No habits yet</span></li>}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- choosing habits: used on the first visit and from "Edit habits" ---------- */
type EditorProps = {
  habits: Habit[];
  setup?: boolean;
  onAdd: (name: string, quiet?: boolean) => void;
  onRemove: (h: Habit, quiet?: boolean) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (id: string, name: string) => void;
  onClear?: () => void;
};

function HabitEditor({ habits, setup, onAdd, onRemove, onMove, onRename, onClear }: EditorProps) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const byName = new Map(habits.map((h) => [h.name.trim(), h]));
  const save = () => { if (editing) onRename(editing.id, editing.name); setEditing(null); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft, setup);
    setDraft("");
  };

  return (
    <div className="hed">
      <div className="hed-mine">
        <div className="hed-h">
          <h3>Your habits <span>{habits.length}</span></h3>
          {setup && habits.length > 0 && onClear && <button type="button" className="linkbtn" onClick={onClear}>Clear all</button>}
        </div>
        <form className="addf" onSubmit={submit}>
          <label className="vh" htmlFor="hNew">New habit</label>
          <input id="hNew" maxLength={60} placeholder="Write your own, e.g. 🏃 Run 2 km" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn primary" type="submit">Add</button>
        </form>
        {habits.length ? (
          <ul className="manage">
            {habits.map((h, i) => (
              <li key={h.id}>
                {editing?.id === h.id ? (
                  <form className="ren" onSubmit={(e) => { e.preventDefault(); save(); }}>
                    <label className="vh" htmlFor={"ren-" + h.id}>Rename {h.name}</label>
                    <input id={"ren-" + h.id} autoFocus maxLength={60} value={editing.name}
                      onChange={(e) => setEditing({ id: h.id, name: e.target.value })} onBlur={save}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} />
                  </form>
                ) : (
                  <button type="button" className="nmb" title="Tap to rename" onClick={() => setEditing({ id: h.id, name: h.name })}>{h.name}</button>
                )}
                <button type="button" className="mini" aria-label={`Move ${h.name} up`} disabled={i === 0} onClick={() => onMove(h.id, -1)}>↑</button>
                <button type="button" className="mini" aria-label={`Move ${h.name} down`} disabled={i === habits.length - 1} onClick={() => onMove(h.id, 1)}>↓</button>
                <button type="button" className="mini rm" aria-label={`Remove ${h.name}`} onClick={() => onRemove(h, setup)}><Close size={14} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="hed-empty">Nothing here yet. Add your own above, or tap a suggestion.</p>}
        <p className="hed-tip">Tap a name to rename it. Use ↑ ↓ to put them in the order you do them.</p>
      </div>

      <div className="hed-sugg">
        <div className="hed-h"><h3>Suggestions</h3><span className="hed-sub">Tap to add or remove</span></div>
        {HABIT_SUGGESTIONS.map((g) => (
          <div key={g.group} className="sg">
            <h4>{g.group}</h4>
            <div className="chips">
              {g.items.map((name) => {
                const h = byName.get(name);
                return (
                  <button key={name} type="button" className={"schip" + (h ? " on" : "")} aria-pressed={!!h}
                    onClick={() => (h ? onRemove(h, setup) : onAdd(name, setup))}>
                    <span className="sk" aria-hidden="true">{h ? "✓" : "+"}</span>{name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
