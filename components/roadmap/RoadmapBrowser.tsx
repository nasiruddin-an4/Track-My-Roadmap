"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Arrow, Close, Search } from "@/components/icons";
import { keyHash } from "@/lib/roadmap";
import { FEATURED_TINTS, FeaturedRoadmapCard, TypeGlyph } from "@/components/roadmap/FeaturedRoadmapCard";

export type BrowseRoadmap = {
  slug: string;
  title: string;
  tagline: string;
  category: string;
  level: string;
  years?: string;
  phases: number;
  topics: number;
  featured: boolean;
  /** Phase titles, so a search for "React" or "Docker" finds the roadmaps that teach it. */
  keywords: string;
  localKey: string;
  /** Hashed progress units (see progressUnits) for the on-device progress bar. */
  units: string[][];
};
export type ComingSoon = { title: string; tagline: string; category: string };

type Filter = "all" | "Career path" | "Skill";
type Sort = "featured" | "az" | "short" | "long";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Career path", label: "Career paths" },
  { value: "Skill", label: "Skills" },
];
const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Recommended" },
  { value: "az", label: "A – Z" },
  { value: "short", label: "Shortest first" },
  { value: "long", label: "Most in-depth" },
];

export function RoadmapBrowser({ roadmaps, comingSoon }: { roadmaps: BrowseRoadmap[]; comingSoon: ComingSoon[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("featured");
  const term = useDeferredValue(query.trim().toLowerCase());
  const inputRef = useRef<HTMLInputElement>(null);
  const progress = useAllProgress(roadmaps);

  // "/" jumps to search, like on most docs sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => ({
    all: roadmaps.length,
    "Career path": roadmaps.filter((r) => r.category === "Career path").length,
    Skill: roadmaps.filter((r) => r.category === "Skill").length,
  }), [roadmaps]);

  const results = useMemo(() => {
    const words = term.split(/\s+/).filter(Boolean);
    const list = roadmaps.filter((r) => {
      if (filter !== "all" && r.category !== filter) return false;
      if (!words.length) return true;
      const hay = `${r.title} ${r.tagline} ${r.keywords}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    // A title match is what people usually mean, so it goes first.
    const titleHit = (r: BrowseRoadmap) => (words.length && words.every((w) => r.title.toLowerCase().includes(w)) ? 0 : 1);
    const by: Record<Sort, (a: BrowseRoadmap, b: BrowseRoadmap) => number> = {
      featured: () => 0,
      az: (a, b) => a.title.localeCompare(b.title),
      short: (a, b) => a.topics - b.topics,
      long: (a, b) => b.topics - a.topics,
    };
    return [...list].sort((a, b) => titleHit(a) - titleHit(b) || by[sort](a, b));
  }, [roadmaps, term, filter, sort]);

  const browsing = !term && filter === "all" && sort === "featured";
  const inProgress = useMemo(
    () => roadmaps.filter((r) => progress[r.slug] != null).sort((a, b) => (progress[b.slug] ?? 0) - (progress[a.slug] ?? 0)),
    [roadmaps, progress],
  );
  const reset = () => { setQuery(""); setFilter("all"); setSort("featured"); inputRef.current?.focus(); };

  return (
    <div className="grid gap-10 pb-16">
      {/* toolbar */}
      <div className="sticky top-[calc(var(--top)+env(safe-area-inset-top))] z-10 -mx-4 border-b border-line/60 bg-bg/85 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 text-muted transition-colors focus-within:border-route">
            <Search />
            <span className="vh">Search roadmaps</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }}
              placeholder="Search roles, skills or topics — e.g. React, Docker"
              className="h-full min-w-0 flex-1 bg-transparent text-[.98rem] text-ink outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink">
                <Close size={14} />
              </button>
            ) : (
              <kbd className="hidden rounded-md border border-line px-1.5 font-mono text-[.72rem] text-muted sm:inline">/</kbd>
            )}
          </label>

          <div className="flex items-center justify-between gap-2">
            <div role="group" aria-label="Filter by type" className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-line">
              {FILTERS.map((f) => (
                <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
                  className={"flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[.86rem] font-semibold whitespace-nowrap transition-colors " +
                    (filter === f.value ? "bg-route text-route-ink" : "text-muted hover:bg-sunk hover:text-ink")}>
                  {f.label}
                  <span className={"hidden font-mono text-[.72rem] sm:inline " + (filter === f.value ? "text-route-ink/70" : "text-muted/80")}>{counts[f.value]}</span>
                </button>
              ))}
            </div>
            <label className="relative shrink-0">
              <span className="vh">Sort roadmaps</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                className="h-10 cursor-pointer appearance-none rounded-xl border border-line bg-surface pr-8 pl-3 text-[.86rem] font-semibold text-ink outline-none focus:border-route">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <svg className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </label>
          </div>
        </div>
      </div>

      <p className="vh" aria-live="polite">{results.length} roadmaps shown</p>

      {browsing ? (
        <>
          {inProgress.length > 0 && (
            <Section title="Continue where you left off" note="Progress saved on this device">
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.slice(0, 6).map((r) => <li key={r.slug}><ResumeCard rm={r} pct={progress[r.slug] ?? 0} /></li>)}
              </ul>
            </Section>
          )}

          <Section title="Not sure where to start?" note="Our most complete roadmaps — a good first pick" icon={<StarGlyph />} tone="highlight">
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 [&>li]:min-w-0 sm:[&>li:nth-child(3)]:col-span-2 lg:[&>li:nth-child(3)]:col-span-1">
              {roadmaps.filter((r) => r.featured).map((r, i) => (
                <li key={r.slug}><FeaturedRoadmapCard rm={r} pct={progress[r.slug]} tint={FEATURED_TINTS[i % FEATURED_TINTS.length]} size="lg" /></li>
              ))}
            </ul>
          </Section>

          <Section id="career-paths" title="Career paths" count={counts["Career path"]} note="Whole roles, from first steps to job-ready" icon={<TypeGlyph skill={false} size={17} />} tone="route">
            <CardGrid items={roadmaps.filter((r) => r.category === "Career path")} progress={progress}
              extra={comingSoon.filter((c) => c.category === "Career path")} />
          </Section>

          <Section id="skills" title="Skills" count={counts.Skill} note="Focused roadmaps for a single language, tool or topic" icon={<TypeGlyph skill size={17} />} tone="warm">
            <CardGrid items={roadmaps.filter((r) => r.category === "Skill")} progress={progress}
              extra={comingSoon.filter((c) => c.category === "Skill")} />
          </Section>
        </>
      ) : results.length ? (
        <Section
          title={term ? <>Results for “{query.trim()}”</> : FILTERS.find((f) => f.value === filter)!.label}
          count={results.length}
          icon={<Search size={16} />}
          tone="route"
          action={<button type="button" onClick={reset} className="text-[.9rem] font-semibold text-route hover:underline">Clear filters</button>}>
          <CardGrid items={results} progress={progress} showType={filter === "all"} />
        </Section>
      ) : (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-surface text-muted"><Search size={20} /></span>
          <h2 className="m-0 font-display text-[1.25rem] font-bold">No roadmaps match “{query.trim()}”</h2>
          <p className="m-0 max-w-[44ch] text-muted">Try a broader word like a language (Python), a tool (Docker) or a role (Backend).</p>
          <button type="button" onClick={reset} className="mt-2 rounded-xl bg-route px-4 py-2 font-semibold text-route-ink hover:brightness-110">
            Show all roadmaps
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- progress ---------- */

const emptySnap = "";
function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Percent done per roadmap slug, read from this device (null = nothing ticked yet). */
function useAllProgress(roadmaps: BrowseRoadmap[]): Record<string, number | null> {
  // One string snapshot of every roadmap's stored progress, so React can compare it cheaply.
  const snap = useSyncExternalStore(
    subscribeStorage,
    () => { try { return roadmaps.map((r) => localStorage.getItem(r.localKey) ?? "").join("\u0000"); } catch { return emptySnap; } },
    () => emptySnap,
  );
  return useMemo(() => {
    const raw = snap ? snap.split("\u0000") : [];
    const out: Record<string, number | null> = {};
    roadmaps.forEach((r, i) => {
      out[r.slug] = null;
      try {
        const d = raw[i] ? (JSON.parse(raw[i]) as { done?: string[] }) : null;
        if (!d?.done?.length || !r.units.length) return;
        const done = new Set(d.done.map(keyHash));
        out[r.slug] = Math.floor((r.units.filter((u) => u.some((k) => done.has(k))).length / r.units.length) * 100);
      } catch { /* ignore a corrupt entry */ }
    });
    return out;
  }, [snap, roadmaps]);
}

/* ---------- layout pieces ---------- */

const TONES = {
  route: "bg-route-soft text-route ring-route/25",
  warm: "bg-warm/10 text-warm ring-warm/25",
  highlight: "bg-highlight/10 text-[#FF8A4C] ring-highlight/25",
} as const;

function Section({ id, title, note, count, icon, tone = "route", action, children }: {
  id?: string; title: React.ReactNode; note?: string; count?: number; icon?: React.ReactNode; tone?: keyof typeof TONES; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-40 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <span className={"grid size-10 shrink-0 place-items-center rounded-xl ring-1 " + TONES[tone]}>{icon}</span>}
          <div className="grid min-w-0 gap-0.5">
            <h2 className="m-0 flex items-center gap-2.5 font-display text-[1.4rem] leading-tight font-bold tracking-[-.02em]">
              {title}
              {count != null && <span className="rounded-full bg-sunk px-2 py-0.5 font-mono text-[.75rem] font-medium tracking-normal text-muted">{count}</span>}
            </h2>
            {note && <p className="m-0 text-[.9rem] text-muted">{note}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardGrid({ items, progress, extra = [], showType = false }: { items: BrowseRoadmap[]; progress: Record<string, number | null>; extra?: ComingSoon[]; showType?: boolean }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((r) => <li key={r.slug}><RoadmapTile rm={r} pct={progress[r.slug]} showType={showType} /></li>)}
      {extra.map((c) => (
        <li key={c.title} className="grid h-full min-h-[176px] content-start gap-2 rounded-2xl border border-dashed border-line bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(148,163,184,.035)_10px_20px)] p-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-warm/10 px-2 py-0.5 text-[.68rem] font-semibold tracking-[.04em] text-warm uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-warm" />Coming soon
          </span>
          <h3 className="m-0 font-display text-[1.08rem] leading-tight font-bold tracking-[-.01em] text-ink/75">{c.title}</h3>
          <p className="m-0 line-clamp-2 text-[.85rem] leading-relaxed text-muted">{c.tagline}</p>
        </li>
      ))}
    </ul>
  );
}

const cardBase = "group relative grid h-full rounded-2xl border bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-route hover:shadow-[0_12px_30px_rgba(0,0,0,.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route";

/** How long a roadmap is, from its topic count. */
function lengthOf(topics: number): { label: string; n: 1 | 2 | 3 } {
  return topics <= 50 ? { label: "Quick", n: 1 } : topics <= 110 ? { label: "Standard", n: 2 } : { label: "In-depth", n: 3 };
}

/** The everyday card: compact so the whole catalogue can be scanned quickly. */
function RoadmapTile({ rm, pct, showType }: { rm: BrowseRoadmap; pct: number | null | undefined; showType: boolean }) {
  const skill = rm.category === "Skill";
  const len = lengthOf(rm.topics);
  return (
    <Link href={`/roadmaps/${rm.slug}`}
      className={"group relative isolate grid h-full min-h-[176px] content-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(0,0,0,.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route " +
        (skill ? "hover:border-warm/60" : "hover:border-route/70")}>
      {/* soft glow that fades in on hover */}
      <span aria-hidden="true" className={"pointer-events-none absolute -top-14 -right-12 -z-10 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100 " + (skill ? "bg-warm/15" : "bg-route/20")} />
      <div className="flex items-start justify-between gap-3">
        <TypeIcon skill={skill} />
        <div className="flex items-center gap-1.5">
          {/beginner$/i.test(rm.level) && (
            <span className="rounded-full bg-done-soft px-2 py-0.5 text-[.68rem] font-semibold tracking-wide text-done">Beginner</span>
          )}
          {rm.featured && (
            <span title="Featured" className="grid size-6 place-items-center rounded-full bg-highlight/10 text-[#FF8A4C]"><StarGlyph size={11} /></span>
          )}
          {pct != null ? (
            <span className="rounded-full bg-done-soft px-2 py-0.5 font-mono text-[.72rem] font-medium text-done">{pct === 100 ? "Done" : `${pct}%`}</span>
          ) : showType ? (
            <span className={"text-[.7rem] font-semibold tracking-[.04em] uppercase " + (skill ? "text-warm" : "text-route")}>{skill ? "Skill" : "Career path"}</span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-1">
        <h3 className="m-0 font-display text-[1.08rem] leading-tight font-bold tracking-[-.01em]">{rm.title}</h3>
        <p className="m-0 line-clamp-2 text-[.85rem] leading-relaxed text-muted">{rm.tagline}</p>
      </div>
      <div className="mt-auto grid gap-2.5 pt-1">
        {pct != null && <Bar pct={pct} />}
        <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
          <Meta rm={rm} />
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[.72rem] font-medium text-muted" title={`${len.label} — ${rm.topics} topics`}>
              <span className="flex items-end gap-[2px]" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <i key={i} className={"block w-[3px] rounded-full " + (i === 1 ? "h-1.5 " : i === 2 ? "h-2.5 " : "h-3.5 ") +
                    (i <= len.n ? (skill ? "bg-warm" : "bg-route") : "bg-line")} />
                ))}
              </span>
              {len.label}
            </span>
            <span className={"grid size-7 place-items-center rounded-full text-muted transition group-hover:text-bg " + (skill ? "group-hover:bg-warm" : "group-hover:bg-route")}>
              <Arrow size={14} />
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function ResumeCard({ rm, pct }: { rm: BrowseRoadmap; pct: number }) {
  return (
    <Link href={`/roadmaps/${rm.slug}/track`} className={cardBase + " content-start gap-3 border-done/30 p-4"}>
      <div className="flex items-center gap-3">
        <Ring pct={pct} />
        <div className="grid min-w-0 gap-0.5">
          <h3 className="m-0 truncate font-display text-[1.05rem] leading-tight font-bold">{rm.title}</h3>
          <span className="text-[.82rem] text-muted">{pct === 100 ? "Completed — nice work" : `${rm.phases} phases · ${rm.topics} topics`}</span>
        </div>
        <span className="ml-auto grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition group-hover:border-done group-hover:bg-done group-hover:text-bg">
          <Arrow size={15} />
        </span>
      </div>
    </Link>
  );
}

/* ---------- small bits ---------- */

function Meta({ rm }: { rm: BrowseRoadmap }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[.72rem] whitespace-nowrap text-muted">
      <span><b className="font-medium text-ink/85">{rm.phases}</b> phases</span><span aria-hidden="true">·</span><span><b className="font-medium text-ink/85">{rm.topics}</b> topics</span>
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Your progress">
      <i className="block h-full rounded-full bg-done" style={{ width: Math.max(pct, 3) + "%" }} />
    </span>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-11 shrink-0 place-items-center">
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--sunk)" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--done)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(pct, 2) / 100)} />
      </svg>
      <span className="absolute font-mono text-[.68rem] font-medium">{pct}%</span>
    </span>
  );
}

function TypeIcon({ skill }: { skill: boolean }) {
  return (
    <span className={"grid size-9 place-items-center rounded-xl ring-1 transition-colors " + (skill ? "bg-warm/10 text-warm ring-warm/15 group-hover:bg-warm/20" : "bg-route-soft text-route ring-route/15 group-hover:bg-route/25")}>
      <TypeGlyph skill={skill} size={18} />
    </span>
  );
}

function StarGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2.8 2.8 5.7 6.3.9-4.55 4.43 1.08 6.27L12 17.14l-5.63 2.96 1.08-6.27L2.9 9.4l6.3-.91L12 2.8Z" />
    </svg>
  );
}
