"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Arrow, Search } from "@/components/icons";
import { FEATURED_TINTS, FeaturedRoadmapCard } from "@/components/roadmap/FeaturedRoadmapCard";

export type RoadmapPreview = {
  slug: string;
  title: string;
  tagline: string;
  category: string;
  phases: number;
  topics: number;
  featured: boolean;
};

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Career paths", value: "Career path" },
  { label: "Skills", value: "Skill" },
];
const PREVIEW_COUNT = 9;

export function RoadmapFinder({ roadmaps }: { roadmaps: RoadmapPreview[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return roadmaps.filter((roadmap) =>
      (category === "all" || roadmap.category === category) &&
      (!term || `${roadmap.title} ${roadmap.tagline}`.toLowerCase().includes(term)),
    );
  }, [category, query, roadmaps]);
  const shown = matches.slice(0, PREVIEW_COUNT);

  return (
    <div className="grid gap-6">
      <label className="flex h-12 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-muted transition-colors focus-within:border-route">
        <Search />
        <span className="vh">Search roadmaps</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${roadmaps.length} roadmaps`}
          className="h-full min-w-0 flex-1 bg-transparent text-[.98rem] text-ink outline-none placeholder:text-muted"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Filter roadmaps by category">
          {CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              aria-pressed={category === item.value}
              className={"rounded-full px-3.5 py-1.5 text-[.86rem] font-semibold transition-colors " +
                (category === item.value
                  ? "bg-route text-bg"
                  : "bg-surface text-muted hover:text-ink")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Link href="/roadmaps" className="inline-flex items-center gap-1.5 text-[.9rem] font-semibold text-route hover:underline">
          All {roadmaps.length} roadmaps <Arrow />
        </Link>
      </div>

      {shown.length ? (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((roadmap) => (
            <li key={roadmap.slug}>
              {roadmap.featured
                ? <FeaturedRoadmapCard rm={roadmap} tint={FEATURED_TINTS[shown.filter((r) => r.featured).indexOf(roadmap) % FEATURED_TINTS.length]} />
                : <RoadmapCard roadmap={roadmap} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-xl border border-line bg-surface px-4 py-6 text-center text-muted">
          No roadmaps match “{query}”.
        </p>
      )}
      {matches.length > PREVIEW_COUNT && (
        <p className="m-0 text-center text-sm text-muted">
          Showing {PREVIEW_COUNT} of {matches.length}.{" "}
          <Link href="/roadmaps" className="font-semibold text-route hover:underline">Browse all roadmaps</Link>
        </p>
      )}
    </div>
  );
}

function RoadmapCard({ roadmap }: { roadmap: RoadmapPreview }) {
  const isSkill = roadmap.category === "Skill";
  const accent = isSkill ? "text-warm" : "text-route";
  const accentBg = isSkill ? "bg-warm/10" : "bg-route-soft";

  return (
    <Link
      href={`/roadmaps/${roadmap.slug}`}
      className="group relative isolate grid h-full min-h-[178px] content-between gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-route hover:shadow-[0_12px_30px_rgba(0,0,0,.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route"
    >
      <span className={"pointer-events-none absolute -right-8 -top-10 -z-10 size-32 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-90 " + (isSkill ? "bg-warm/20" : "bg-route/20")} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={"grid size-9 place-items-center rounded-xl " + accentBg}>
            {isSkill ? <SkillIcon className={accent} /> : <CareerIcon className={accent} />}
          </span>
          <span className={"text-[.72rem] font-semibold tracking-[.04em] uppercase " + accent}>
            {isSkill ? "Skill roadmap" : "Career path"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full border border-line text-muted transition group-hover:border-route group-hover:bg-route group-hover:text-bg">
            <Arrow size={15} />
          </span>
        </div>
      </div>

      <div className="grid gap-1.5">
        <h3 className="m-0 font-display text-[1.14rem] leading-tight font-bold tracking-[-.02em] group-hover:text-ink">
          {roadmap.title}
        </h3>
        <p className="m-0 line-clamp-2 text-[.83rem] leading-relaxed text-muted">{roadmap.tagline}</p>
      </div>

      <div className="flex items-center gap-2 border-t border-line/70 pt-3 font-mono text-[.72rem] text-muted">
        <RouteMark className={accent} />
        <span>{roadmap.phases} phases</span>
        <span aria-hidden="true" className="text-line">·</span>
        <span>{roadmap.topics} topics</span>
      </div>
    </Link>
  );
}

function CareerIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3" />
    </svg>
  );
}

function SkillIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
    </svg>
  );
}

function RouteMark({ className }: { className: string }) {
  return (
    <svg className={className} width="17" height="10" viewBox="0 0 34 10" fill="none" aria-hidden="true">
      <path d="M3 5h28" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" />
      <circle cx="3" cy="5" r="3" fill="currentColor" />
      <circle cx="17" cy="5" r="3" fill="currentColor" opacity=".55" />
      <circle cx="31" cy="5" r="3" fill="currentColor" opacity=".35" />
    </svg>
  );
}
