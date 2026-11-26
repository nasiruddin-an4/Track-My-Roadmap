"use client";

/*
 * Layout: a sticky transit-style route rail of phases beside a one-phase-at-a-time
 * workspace; on phones the rail becomes a scrolling stop strip.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { Check, Close, Dots, Loop, Search } from "@/components/icons";
import { useToast } from "@/components/toast";
import { buildRoadmap, cardTally, computeProgress, phaseMark, videoSlots, type Card, type Phase, type Progress, type RoadmapDef, type Row, type Tag, type Tally } from "@/lib/roadmap";
import { YouTubeMark } from "@/components/roadmap/ResourceLink";
import { ExplainButton, ExplainPanel } from "@/components/roadmap/TopicExplain";
import { VideoPlayer, type WatchRequest } from "@/components/roadmap/VideoPlayer";
import { habitSummary, type HabitDoc } from "@/lib/habits";
import { loadProgress, saveProgress } from "@/lib/progressRow";
import type { ResourceMap, TopicResource } from "@/lib/resources";
import { HABITS_KEY, UI_KEY, writeJSON } from "@/lib/storage";
import { syncLabel, useCloudDoc, type SyncStatus } from "@/lib/useCloudDoc";
import { emitLocalChange, useHash, useLocalItem } from "@/lib/useLocal";

type Doc = { done: string[]; updatedAt: number; completedAt: number | null };
type Filter = "all" | "todo" | "done";

const TAG_TEXT: Partial<Record<Tag, string>> = { opt: "Optional", adv: "Advanced" };
const PILL: Record<string, string> = { done: "Complete", current: "You’re here", started: "In progress", upcoming: "Not started", ongoing: "Ongoing" };
const pad = (n: number) => (n < 10 ? "0" + n : String(n));
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function progressDoc(slug: string) {
  return {
    empty: (): Doc => ({ done: [], updatedAt: 0, completedAt: null }),
    normalize: (raw: unknown): Doc => {
      const r = (raw || {}) as Partial<Doc>;
      return { done: Array.isArray(r.done) ? r.done.filter((x) => typeof x === "string") : [], updatedAt: Number(r.updatedAt) || 0, completedAt: Number(r.completedAt) || null };
    },
    load: (sb: SupabaseClient, uid: string): Promise<Doc | null> => loadProgress(sb, uid, slug),
    save: (sb: SupabaseClient, uid: string, d: Doc) => saveProgress(sb, uid, slug, d),
  };
}

const NO_RESOURCES: ResourceMap = {};

/** `explain`: show the "What is this?" button on each topic (an AI provider is set up; see lib/explain.ts). */
export function RoadmapTracker({ def, resources = NO_RESOURCES, explain = false }: { def: RoadmapDef; resources?: ResourceMap; explain?: boolean }) {
  const rm = useMemo(() => buildRoadmap(def), [def]);
  const toast = useToast();
  const { user } = useAuth();
  const docOpts = useMemo(() => ({ localKey: def.localKey, ...progressDoc(def.slug) }), [def.localKey, def.slug]);
  const { doc, update, status, loads, hydrated } = useCloudDoc<Doc>(docOpts);
  const done = useMemo(() => new Set(doc.done), [doc.done]);

  const uiRaw = useLocalItem(UI_KEY);
  const countOpt = useMemo(() => { try { return !!(uiRaw && JSON.parse(uiRaw).countOpt); } catch { return false; } }, [uiRaw]);

  const p = useMemo(() => computeProgress(rm, done, countOpt), [rm, done, countOpt]);
  const last = rm.numbered[rm.numbered.length - 1];

  /* ---------- which phase is open ---------- */
  const [query, setQuery] = useState("");
  const [watch, setWatch] = useState<WatchRequest | null>(null); // the video popup
  const [filter, setFilter] = useState<Filter>("all");
  const [navId, setNavId] = useState<string | null>(null); // the phase the visitor picked
  const hash = useHash().replace(/^#/, "");
  const hashPhase = rm.byId[hash]?.ongoing ? rm.byId[hash] : rm.numbered[+(/^phase-(\d+)$/.exec(hash)?.[1] ?? 0) - 1];

  // a new link (#phase-3) wins over an earlier pick
  useEffect(() => {
    const onHash = () => { setNavId(null); setQuery(""); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // otherwise land on the phase you're on: re-checked each time progress loads, until you pick one yourself
  const [pin, setPin] = useState<{ loads: number; id: string } | null>(null);
  if (!navId && !hashPhase && pin?.loads !== loads) setPin({ loads, id: (p.current ?? last).id });

  const view = (navId && rm.byId[navId]) || hashPhase || (pin && rm.byId[pin.id]) || p.current || last;

  const titleRef = useRef<HTMLHeadingElement>(null);
  const select = useCallback((ph: Phase, focus = false) => {
    setNavId(ph.id);
    setQuery("");
    try { history.replaceState(null, "", "#" + (ph.ongoing ? ph.id : "phase-" + ph.num)); } catch {}
    window.scrollTo(0, 0);
    if (focus) requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }, []);

  /* ---------- search ---------- */
  const q = query.trim().toLowerCase();
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName || "";
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  /* ---------- editing ---------- */
  const lastFull = useRef<Record<string, boolean> | null>(null);
  const edited = useRef(false);
  const lastEdit = useRef(0);
  const edit = useCallback((fn: (s: Set<string>) => void) => {
    edited.current = true;
    lastEdit.current = Date.now();
    update((d) => { const s = new Set(d.done); fn(s); return { ...d, done: Array.from(s) }; });
  }, [update]);

  // remember when the roadmap was completed (every phase complete: its required topics ticked, or marked complete by
  // the learner; optional topics are never needed) for the certificate; clear it if a phase is reopened
  const complete = useMemo(() => computeProgress(rm, done, false).complete, [rm, done]);
  useEffect(() => {
    if (!hydrated) return;
    if (complete && !doc.completedAt) {
      // just finished here: now; already complete before dates were kept: the last edit is the best guess
      const at = Date.now() - lastEdit.current < 10_000 ? Date.now() : doc.updatedAt || Date.now();
      update((d) => (d.completedAt ? d : { ...d, completedAt: at }));
    } else if (!complete && doc.completedAt) {
      update((d) => ({ ...d, completedAt: null }));
    }
  }, [complete, doc.completedAt, doc.updatedAt, hydrated, update]);
  const toggle = (key: string, on: boolean) => edit((s) => (on ? s.add(key) : s.delete(key)));

  // "Phase N complete" when a tick finishes a phase
  useEffect(() => {
    const prev = lastFull.current;
    lastFull.current = { ...p.full };
    if (!prev || !edited.current) return;
    edited.current = false;
    const finished = rm.numbered.filter((ph) => p.full[ph.id] && prev[ph.id] === false);
    if (!finished.length) return;
    const ph = finished[finished.length - 1], cur = p.current;
    if (cur) toast(`Phase ${ph.num} complete.`, cur === view ? undefined : { label: `Start Phase ${cur.num}`, run: () => select(cur, true) });
    else toast(`All ${rm.numbered.length} phases complete. Time to ship and apply.`);
  }, [p, rm, toast, view, select]);

  /** Finish a phase without ticking anything: topics the learner didn't tick stay unticked. Then open the next phase. */
  const completePhase = (ph: Phase) => {
    edit((s) => s.add(phaseMark(ph.id)));
    const nx = ph.num ? rm.numbered[ph.num] : undefined;
    if (nx) select(nx, true);
  };
  const reopenPhase = (ph: Phase) => edit((s) => s.delete(phaseMark(ph.id)));

  const showNext = () => {
    if (!p.next) return;
    setFilter("all");
    requestAnimationFrame(() => {
      const n = p.next!;
      const el = document.querySelector<HTMLElement>(n.pick ? `article[data-card="${n.cardId}"]` : `.row[data-k="${CSS.escape(n.key)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
      el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      el.querySelector("input")?.focus({ preventScroll: true });
    });
  };

  const setOpt = (v: boolean) => { writeJSON(UI_KEY, { countOpt: v }); emitLocalChange(); };
  const reset = () => { edit((s) => s.clear()); toast("Progress cleared"); select(rm.numbered[0], true); };

  /* ---------- views ---------- */
  const isNext = (key: string) => !q && view === p.current && p.next && !p.next.pick && p.next.key === key;
  const nextCard = !q && view === p.current && p.next?.pick ? p.next.cardId : null;
  const onWatch = useCallback((topic: string, list: TopicResource[]) => setWatch({ topic, list }), []);
  const cardProps = { done, countOpt, filter, isNext, nextCard, resources, onWatch, onToggle: toggle, slug: def.slug, explain };
  // the next topic's video: its card's (when videos go on the card heading) or its own
  const nextSlot = p.next && !p.next.pick ? videoSlots(rm.cardById[p.next.cardId])[0] : undefined;
  const nextList = p.next && !p.next.pick ? resources[nextSlot?.whole ? nextSlot.key : p.next.key] : undefined;
  const nextTopic = nextSlot?.whole ? rm.cardById[p.next!.cardId].title : p.next?.label ?? "";

  let main: React.ReactNode;
  let rowsShown: Row[] = [];
  if (q) {
    const groups = rm.phases.map((ph) => ({
      ph,
      hits: ph.cards.map((c) => ({ c, rows: c.title.toLowerCase().includes(q) ? c.rows : c.rows.filter((r) => r.name.toLowerCase().includes(q)) })).filter((h) => h.rows.length),
    })).filter((g) => g.hits.length);
    const n = groups.reduce((a, g) => a + g.hits.reduce((b, h) => b + h.rows.length, 0), 0);
    rowsShown = groups.flatMap((g) => g.hits.flatMap((h) => h.rows));
    main = (
      <>
        <header className="ph-head">
          <span className="eyebrow">Search</span>
          <h1 ref={titleRef} tabIndex={-1}>“{query.trim()}”</h1>
          <p className="desc">{n ? `${n} ${n === 1 ? "topic" : "topics"} across ${groups.length} ${groups.length === 1 ? "phase" : "phases"}. Tick them off here or open the phase.` : "No topics match. Try a shorter word."}</p>
        </header>
        {n ? (
          <>
            <Toolbar filter={filter} setFilter={setFilter} rows={rowsShown} done={done} />
            {groups.map((g) => {
              const vis = g.hits.filter((h) => h.rows.some((r) => matches(r, done, filter)));
              if (!vis.length) return null;
              return (
                <section className="rgroup" key={g.ph.id}>
                  <div className="rg-h">
                    <span className="eyebrow">{g.ph.ongoing ? "Ongoing" : "Phase " + pad(g.ph.num!)}</span>
                    <button type="button" className="link" onClick={() => select(g.ph, true)}>{g.ph.title} →</button>
                  </div>
                  <div className="cards">{vis.map((h) => <CardView key={h.c.id} card={h.c} ph={g.ph} rows={h.rows} {...cardProps} />)}</div>
                </section>
              );
            })}
            <EmptyFilter rows={rowsShown} done={done} filter={filter} />
          </>
        ) : (
          <div className="empty">Nothing found for “{query.trim()}”.<br /><button type="button" className="btn" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>Clear search</button></div>
        )}
      </>
    );
  } else {
    const ph = view, t = p.tallies[ph.id], st = p.status(ph), cur = p.current;
    rowsShown = ph.cards.flatMap((c) => c.rows);
    const prev = ph.num ? rm.numbered[ph.num - 2] : undefined, nx = ph.num ? rm.numbered[ph.num] : undefined;
    main = (
      <>
        <header className="ph-head">
          <div className="ph-k">
            <span className="eyebrow">{ph.ongoing ? "Alongside every phase" : `Phase ${pad(ph.num!)} / ${rm.numbered.length}`}</span>
            <span className="pill" data-st={st}>{PILL[st]}</span>
          </div>
          <h1 ref={titleRef} tabIndex={-1}>{ph.title}</h1>
          <p className="desc">{ph.description}</p>
          <div className="ph-prog">
            <span className={"bar" + (st === "done" ? " is-done" : "")}><i style={{ width: (t.t ? (t.d / t.t) * 100 : 0) + "%" }} /></span>
            <span className="mono">{t.d} / {t.t} topics</span>
          </div>
        </header>
        {cur && ph !== cur && (
          <div className="banner">
            <p>{ph.ongoing ? "Keep these going while you work on " : p.full[ph.id] ? "Phase done. Your route continues at " : "You’re currently on "}<strong>Phase {cur.num}: {cur.title}</strong>.</p>
            <button type="button" className="btn" onClick={() => select(cur, true)}>Go to Phase {cur.num}</button>
          </div>
        )}
        {ph === cur && p.next && (
          <div className="next">
            <div className="next-b">
              <span className="eyebrow">Up next</span>
              <div className="next-t"><strong>{p.next.label}</strong> <span>{p.next.ctx && rm.cardById[p.next.cardId]?.key ? "in " + p.next.ctx : ""}</span></div>
            </div>
            <div className="next-a">
              {!p.next.pick && <button type="button" className="btn primary" onClick={() => toggle(p.next!.key, true)}><Check size={16} />Mark done</button>}
              {nextList?.length ? (
                <button type="button" className="btn" onClick={() => onWatch(nextTopic, nextList)}>
                  <YouTubeMark size={16} />Watch<span className="vh"> the recommended video for {nextTopic}</span>
                </button>
              ) : null}
              <button type="button" className="btn" onClick={showNext}>{p.next.pick ? "Choose now" : "Show in list"}</button>
            </div>
          </div>
        )}
        <Toolbar filter={filter} setFilter={setFilter} rows={rowsShown} done={done} />
        <div className="cards">{ph.cards.map((c) => <CardView key={c.id} card={c} ph={ph} rows={c.rows} {...cardProps} />)}</div>
        <EmptyFilter rows={rowsShown} done={done} filter={filter} />
        {!ph.ongoing && (
          <PhaseFinish ph={ph} next={nx} tally={t} full={!!p.full[ph.id]} marked={!!p.marked[ph.id]}
            onComplete={() => completePhase(ph)} onReopen={() => reopenPhase(ph)} onNext={() => nx && select(nx, true)} />
        )}
        {!ph.ongoing && (
          <nav className="pager" aria-label="Phase navigation">
            {prev && <button type="button" className="pg" onClick={() => select(prev, true)}><span className="eyebrow">← Phase {prev.num}</span><span className="pg-t">{prev.title}</span></button>}
            {nx && <button type="button" className="pg nx" onClick={() => select(nx, true)}><span className="eyebrow">Phase {nx.num} →</span><span className="pg-t">{nx.title}</span></button>}
          </nav>
        )}
      </>
    );
  }

  const stopProps = { p, view: q ? null : view, onGo: (ph: Phase) => select(ph) };

  const firstName = ((user?.user_metadata?.full_name as string) || "").split(" ")[0];

  return (
    <>
      <DashHeader def={def} p={p} phases={rm.numbered.length} firstName={firstName} />

      <nav className="strip" aria-label="Phases">
        <StripScroller viewId={q ? null : view.id}>
          {rm.numbered.map((ph) => <Stop key={ph.id} ph={ph} mode="strip" {...stopProps} />)}
          {rm.ongoing.length > 0 && <span className="strip-sep" aria-hidden="true" />}
          {rm.ongoing.map((ph) => <Stop key={ph.id} ph={ph} mode="strip" {...stopProps} />)}
        </StripScroller>
      </nav>

      <div className="wrap shell">
        <aside className="rail" aria-label="Your route">
          <nav className="route" aria-labelledby="routeH">
            <div className="route-h">
              <div className="eyebrow" id="routeH">Your route · {rm.numbered.length} phases</div>
              <div className="route-sum"><b>{p.phasesDone}</b> of {rm.numbered.length} phases complete</div>
              {/* one segment per phase: green done, orange where you are, blue started */}
              <div className="segs" aria-hidden="true">{rm.numbered.map((ph) => <i key={ph.id} data-st={p.status(ph)} />)}</div>
            </div>
            <ol>{rm.numbered.map((ph) => <Stop key={ph.id} ph={ph} mode="rail" {...stopProps} />)}</ol>
          </nav>
          {rm.ongoing.length > 0 && (
            <nav className="route" aria-labelledby="ongH">
              <div className="eyebrow" id="ongH">Alongside every phase</div>
              <ul>{rm.ongoing.map((ph) => <Stop key={ph.id} ph={ph} mode="rail" {...stopProps} />)}</ul>
            </nav>
          )}
        </aside>

        <div className="content">
          <div className="mb-5 flex items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[11px] border border-line bg-surface pr-2.5 pl-3 text-muted focus-within:border-route focus-within:shadow-[0_0_0_3px_var(--route-soft)] lg:max-w-[440px]">
              <Search />
              <span className="vh">Search all topics in {def.title}</span>
              <input ref={searchRef} type="search" value={query} placeholder="Search all topics" autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); e.currentTarget.blur(); } }}
                className="h-10 min-w-0 flex-1 bg-transparent text-[.95rem] text-ink outline-none [&::-webkit-search-cancel-button]:hidden" />
              {query ? (
                <button type="button" aria-label="Clear search" className="grid place-items-center rounded-md p-1" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><Close /></button>
              ) : (
                <kbd aria-hidden="true" className="hidden rounded-md border border-line bg-bg px-1.5 font-mono text-[.72rem] sm:inline">/</kbd>
              )}
            </label>
            <SettingsMenu countOpt={countOpt} setCountOpt={setOpt} status={status} signedIn={!!user} onReset={reset} />
          </div>
          <main>{main}</main>
        </div>
      </div>
      <VideoPlayer watch={watch} onClose={() => setWatch(null)} />
    </>
  );
}

/* ---------- pieces ---------- */

function matches(r: Row, done: Set<string>, f: Filter) {
  return f === "all" || (f === "done") === done.has(r.key);
}

function Toolbar({ filter, setFilter, rows, done }: { filter: Filter; setFilter: (f: Filter) => void; rows: Row[]; done: Set<string> }) {
  const d = rows.filter((r) => done.has(r.key)).length;
  const cnt = { all: rows.length, todo: rows.length - d, done: d };
  const opts: [Filter, string][] = [["all", "All"], ["todo", "To do"], ["done", "Done"]];
  return (
    <div className="toolbar">
      <div className="filters" role="radiogroup" aria-label="Show topics">
        {opts.map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="f" value={v} checked={filter === v} onChange={() => setFilter(v)} />
            {l} <span className="fc">{cnt[v]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function EmptyFilter({ rows, done, filter }: { rows: Row[]; done: Set<string>; filter: Filter }) {
  if (!rows.length || rows.some((r) => matches(r, done, filter))) return null;
  return <div className="empty">{filter === "done" ? "Nothing ticked off here yet." : "Everything here is done. Nice work."}</div>;
}

// Topics are only ever ticked one at a time, by the learner. (A card-level "Mark all done" used to tick every topic in
// the card, including ones the learner never chose; finishing a phase early is "Mark phase complete" instead.)
type CardProps = {
  card: Card; ph: Phase; rows: Row[];
  done: Set<string>; countOpt: boolean; filter: Filter;
  isNext: (key: string) => boolean | null | undefined; nextCard: string | null;
  resources: ResourceMap;
  onWatch: (topic: string, list: TopicResource[]) => void;
  onToggle: (key: string, on: boolean) => void;
  slug: string; explain: boolean;
};

function CardView({ card, ph, rows, done, countOpt, filter, isNext, nextCard, resources, onWatch, onToggle, slug, explain }: CardProps) {
  const visible = rows.filter((r) => matches(r, done, filter));
  if (!visible.length) return null;
  const pick = card.mode === "pick";
  const t = cardTally(card, ph, done, countOpt);
  const complete = t.t > 0 && t.d === t.t;
  // videos for the whole card sit on its heading; otherwise ("Key concepts", "Pick one") on each topic
  const slot = videoSlots(card)[0];
  const whole = slot?.whole ? slot : null;
  const cardRes = whole ? resources[whole.key] : undefined;
  return (
    <article className={"card" + (complete ? " complete" : "") + (nextCard === card.id ? " is-next" : "")} data-card={card.id}>
      <div className="card-h">
        <h3>{card.title}</h3>
        {pick ? <span className="tag pick">Pick one</span> : <TagChip tag={card.tag} />}
        <span className="cc mono">{pick ? (t.d ? "Chosen" : "Choose 1") : `${t.d}/${t.t}`}</span>
        {whole && cardRes?.length ? <WatchButton topic={card.title} list={cardRes} onWatch={onWatch} /> : null}
      </div>
      <div className="cbar"><i style={{ width: (t.t ? (t.d / t.t) * 100 : 0) + "%" }} /></div>
      <div className="rows">
        {visible.map((r) => {
          const res = whole ? undefined : resources[r.key];
          const label = (
            <label className={"row" + (pick ? " pickrow" : "") + (isNext(r.key) ? " is-next" : "")} data-k={r.key}>
              <input type="checkbox" checked={done.has(r.key)} onChange={(e) => onToggle(r.key, e.target.checked)} />
              <span className="cb"><Check /></span>
              <span className="rl">{r.name}</span>
              <TagChip tag={r.tag} />
            </label>
          );
          return <TopicRow key={r.key} row={r} label={label} res={res} onWatch={onWatch} slug={slug} explain={explain} />;
        })}
      </div>
    </article>
  );
}

/** One topic: its checkbox, its video (if any) and "What is this?", which opens a short explanation underneath. */
function TopicRow({ row, label, res, onWatch, slug, explain }: {
  row: Row; label: React.ReactNode; res?: TopicResource[]; onWatch: (topic: string, list: TopicResource[]) => void; slug: string; explain: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="row-w">
      {label}
      {res?.length ? <WatchButton topic={row.name} list={res} onWatch={onWatch} /> : null}
      {explain && <ExplainButton topic={row.name} open={open} controls={id} onToggle={() => setOpen(!open)} />}
      {open && <ExplainPanel id={id} slug={slug} topicKey={row.key} topic={row.name} />}
    </div>
  );
}

/** Opens the recommended video(s) for a card or topic in the in-page player. */
function WatchButton({ topic, list, onWatch }: { topic: string; list: TopicResource[]; onWatch: (topic: string, list: TopicResource[]) => void }) {
  return (
    <button type="button" className="vid-b" onClick={() => onWatch(topic, list)}
      aria-label={`Watch ${list.length === 1 ? "the recommended video" : `${list.length} recommended videos`} for ${topic}`}>
      <YouTubeMark size={14} />Watch{list.length > 1 && <span className="mono">· {list.length}</span>}
    </button>
  );
}

function TagChip({ tag }: { tag: Tag }) {
  return TAG_TEXT[tag] ? <span className={"tag " + tag}>{TAG_TEXT[tag]}</span> : null;
}

/** The end of a phase: mark it complete and move on (only ticked topics count as done), or see that it's done. */
function PhaseFinish({ ph, next, tally, full, marked, onComplete, onReopen, onNext }: {
  ph: Phase; next?: Phase; tally: Tally; full: boolean; marked: boolean;
  onComplete: () => void; onReopen: () => void; onNext: () => void;
}) {
  const left = tally.t - tally.d;
  if (full) {
    return (
      <section className="finish is-done" aria-label={`Phase ${ph.num} complete`}>
        <span className="finish-ic" aria-hidden="true"><Check size={18} /></span>
        <div className="finish-t">
          <b>Phase {ph.num} complete</b>
          <p>
            {left > 0
              ? `You marked it complete with ${tally.d} of ${tally.t} topics ticked. The other ${left} stay unticked, so you can come back to them any time.`
              : `All ${tally.t} topics ticked.`}
            {!next && " That was the last phase: the roadmap is complete."}
          </p>
        </div>
        <div className="finish-a">
          {marked && left > 0 && <button type="button" className="btn ghost" onClick={onReopen}>Reopen phase</button>}
          {next && <button type="button" className="btn primary" onClick={onNext}>Go to Phase {next.num} →</button>}
        </div>
      </section>
    );
  }
  return (
    <section className="finish" aria-label={`Finish Phase ${ph.num}`}>
      <div className="finish-t">
        <b>Done with this phase?</b>
        <p>
          Mark it complete {next ? <>to move on to <strong>Phase {next.num}: {next.title}</strong></> : "to finish the roadmap"}.
          {" "}Only the {tally.d} topic{tally.d === 1 ? "" : "s"} you ticked count as done; the other {left} stay unticked.
        </p>
      </div>
      <div className="finish-a">
        <button type="button" className="btn primary" onClick={onComplete}><Check size={16} />Mark Phase {ph.num} complete</button>
      </div>
    </section>
  );
}

/** One phase on the route: a numbered marker (a tick when done), its name, and how far along it is. */
function Stop({ ph, mode, p, view, onGo }: { ph: Phase; mode: "rail" | "strip"; p: Progress; view: Phase | null; onGo: (ph: Phase) => void }) {
  const st = p.status(ph), t = p.tallies[ph.id], sel = ph === view;
  const pct = t.t ? Math.round((t.d / t.t) * 100) : 0;
  const partly = !!p.marked[ph.id] && t.d < t.t;
  const mk = (
    <span className="mk" aria-hidden="true">
      {ph.ongoing ? <Loop /> : <><span className="n">{ph.num}</span><Check size={14} className="ck" /></>}
    </span>
  );
  const meta = st === "done" ? (partly ? `Complete · ${t.d}/${t.t} ticked` : "Complete")
    : st === "current" ? <><em>You’re here</em> · {t.d}/{t.t}</>
    : st === "started" ? `In progress · ${t.d}/${t.t}`
    : st === "ongoing" ? `${t.d}/${t.t} · ongoing`
    : `${t.t} topics`;
  const label = `${ph.ongoing ? "" : `Phase ${ph.num}, `}${ph.title}, ${st === "done" ? "complete, " : ""}${t.d} of ${t.t} topics done${st === "current" ? ", you’re here" : ""}`;
  const btn = (
    <button type="button" className="stop" data-st={st} aria-current={sel ? "page" : undefined} aria-label={label} onClick={() => onGo(ph)}>
      {mk}
      {mode === "strip" ? <span className="st-n">{ph.short}</span> : (
        <span className="st-t">
          <span className="st-n">{ph.title}</span>
          <span className="st-c">{meta}</span>
          {(st === "current" || st === "started") && <span className="st-bar" aria-hidden="true"><i style={{ width: pct + "%" }} /></span>}
        </span>
      )}
    </button>
  );
  return mode === "strip" ? btn : <li data-st={st}>{btn}</li>;
}

/** Keeps the selected stop centred in the phone strip. */
function StripScroller({ viewId, children }: { viewId: string | null; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const center = () => {
      const s = ref.current, b = s?.querySelector<HTMLElement>('[aria-current="page"]');
      if (s && b && s.clientWidth) s.scrollLeft = b.offsetLeft - (s.clientWidth - b.offsetWidth) / 2;
    };
    center();
    window.addEventListener("resize", center);
    return () => window.removeEventListener("resize", center);
  }, [viewId]);
  return <div className="strip-in" ref={ref}>{children}</div>;
}

const RC = 2 * Math.PI * 27;

/** Today's habit count from the habit tracker (this device's synced copy), for the shortcut chip. */
function useTodayHabits() {
  const raw = useLocalItem(HABITS_KEY);
  return useMemo(() => {
    try {
      const d = raw ? (JSON.parse(raw) as HabitDoc) : null;
      if (!d || !Array.isArray(d.habits) || !d.habits.length) return null;
      return habitSummary({ habits: d.habits, checks: d.checks || {} }, new Date());
    } catch {
      return null;
    }
  }, [raw]);
}

/** Top of the tracker: greeting, where you are, four progress tiles and a shortcut to today's habits. */
function DashHeader({ def, p, phases, firstName }: { def: RoadmapDef; p: Progress; phases: number; firstName: string }) {
  const frac = p.total ? p.done / p.total : 0;
  const cur = p.current;
  const habits = useTodayHabits();
  const hasHabits = p.habitsTotal > 0; // only roadmaps with "alongside every phase" tracks
  return (
    <section aria-label="Your progress" className="wrap pt-8 pb-2">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid gap-1.5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[.88rem] text-muted">
            <Link href="/roadmaps" className="hover:text-ink">Roadmaps</Link>
            <span aria-hidden="true">›</span>
            <Link href={`/roadmaps/${def.slug}`} className="hover:text-ink">{def.title}</Link>
          </nav>
          <p className="m-0 font-display text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-bold tracking-[-.03em]">
            {firstName ? <>Welcome back, <span className="text-highlight">{firstName}</span></> : <>{def.title} <span className="text-highlight">roadmap</span></>}
          </p>
          <p className="m-0 text-muted">
            {cur ? <>You’re on <b className="font-semibold text-ink">Phase {cur.num} · {cur.title}</b></> : <b className="font-semibold text-ink">Every phase complete. Time to ship and apply.</b>}
          </p>
        </div>
        <Link href="/habits/track"
          className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-muted sm:w-auto sm:min-w-[220px]">
          <span className="grid size-9 place-items-center rounded-xl bg-done-soft text-done">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4M9 15l2 2 4-4" /></svg>
          </span>
          <span className="grid flex-1 gap-1">
            <span className="flex items-baseline justify-between gap-3 text-[.9rem] font-semibold">
              Today’s habits
              {habits && <span className="font-mono text-[.78rem] font-medium text-muted">{habits.today}/{habits.total}</span>}
            </span>
            {habits
              ? <span className="block h-1.5 overflow-hidden rounded-full bg-sunk"><i className="block h-full rounded-full bg-done" style={{ width: (habits.total ? (habits.today / habits.total) * 100 : 0) + "%" }} /></span>
              : <span className="text-[.82rem] text-muted">Open the habit tracker</span>}
          </span>
          <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      <dl className={"mt-5 grid gap-2 sm:mt-6 sm:gap-3 " + (hasHabits ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
        <div className={"flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4 lg:col-span-1 " + (hasHabits ? "col-span-3" : "col-span-2")}>
          <div className="pring !size-14 flex-none">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle className="trk" cx="32" cy="32" r="27" fill="none" strokeWidth="7" />
              <circle className="val" cx="32" cy="32" r="27" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={RC.toFixed(2)} strokeDashoffset={(RC * (1 - frac)).toFixed(2)} />
            </svg>
            <b className="!text-[.75rem]">{Math.floor(frac * 100)}%</b>
          </div>
          <div className="grid">
            <dt className="text-[.82rem] text-muted">Overall progress</dt>
            <dd className="m-0 font-display text-[1.15rem] font-semibold">{Math.floor(frac * 100)}% done</dd>
          </div>
        </div>
        <Tile n={`${p.done}`} of={p.total} l="topics done" />
        <Tile n={`${p.phasesDone}`} of={phases} l="phases complete" />
        {hasHabits && <Tile n={`${p.habitsDone}`} of={p.habitsTotal} l="career habits" />}
      </dl>
    </section>
  );
}

function Tile({ n, of, l }: { n: string; of: number; l: string }) {
  return (
    <div className="grid content-center gap-1 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <dt className="order-2 text-[.75rem] leading-snug text-muted sm:text-[.82rem]">{l}</dt>
      <dd className="order-1 m-0 font-display text-[1.3rem] leading-none font-bold tracking-[-.02em] tabular-nums sm:text-[1.6rem]">
        {n}<span className="text-[.85rem] font-semibold text-muted sm:text-[1rem]"> / {of}</span>
      </dd>
    </div>
  );
}


function SettingsMenu({ countOpt, setCountOpt, status, signedIn, onReset }: { countOpt: boolean; setCountOpt: (v: boolean) => void; status: SyncStatus; signedIn: boolean; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", click); document.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="menu-w" ref={box}>
      <button type="button" className="ibtn !size-11" aria-expanded={open} aria-label="Roadmap settings" onClick={() => setOpen(!open)}><Dots /></button>
      {open && (
        <div className="menu">
          <h2>How it works</h2>
          <div className="legend">
            <div><span className="tag opt">Optional</span> Nice to have, not counted by default</div>
            <div><span className="tag adv">Advanced</span> Deeper topics, counted</div>
            <div><span className="tag pick">Pick one</span> Any one choice completes it</div>
          </div>
          <label className="toggle">Count optional topics<input type="checkbox" checked={countOpt} onChange={(e) => setCountOpt(e.target.checked)} /></label>
          <p className="sync-m">{signedIn && status === "saved" ? "Progress is saved to your account and follows you across devices." : syncLabel(status) + "."}</p>
          <button type="button" className="danger" onClick={() => { if (!armed) { setArmed(true); return; } setArmed(false); setOpen(false); onReset(); }}>
            {armed ? "Click again to erase all ticks" : "Reset progress"}
          </button>
        </div>
      )}
    </div>
  );
}
