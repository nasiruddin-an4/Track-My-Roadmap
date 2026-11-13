import Link from "next/link";
import { Arrow } from "@/components/icons";

/** Soft accent colours (as "r g b") for featured cards, used in turn: blue, violet, teal. */
export const FEATURED_TINTS = ["124 149 255", "174 155 255", "92 207 217"];

export type FeaturedRoadmap = {
  slug: string;
  title: string;
  tagline: string;
  category: string;
  phases: number;
  topics: number;
  years?: string;
};

/**
 * Spotlight card for a featured roadmap: a soft tinted wash, a little phase route and a Start / Continue button.
 * `pct` is this device's progress (null or undefined = not started).
 */
export function FeaturedRoadmapCard({ rm, tint = FEATURED_TINTS[0], pct, size = "md" }: {
  rm: FeaturedRoadmap;
  tint?: string;
  pct?: number | null;
  size?: "md" | "lg";
}) {
  const isSkill = rm.category === "Skill";
  const started = pct != null;
  return (
    <Link
      href={`/roadmaps/${rm.slug}`}
      style={{ "--tint": tint } as React.CSSProperties}
      className={"group relative isolate grid h-full content-between gap-5 overflow-hidden rounded-2xl border border-[rgb(var(--tint)/.32)] bg-surface shadow-[0_10px_30px_rgba(8,12,30,.35),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-1 hover:border-[rgb(var(--tint)/.7)] hover:shadow-[0_18px_44px_rgb(var(--tint)/.16),inset_0_1px_0_rgba(255,255,255,.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--tint))] " +
        (size === "lg" ? "min-h-[236px] p-6" : "min-h-[214px] p-5")}
    >
      {/* soft highlights: a wash from the top-left, a faint glow bottom-right, both brighten on hover */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_85%_at_0%_0%,rgb(var(--tint)/.15),transparent_58%),radial-gradient(80%_70%_at_100%_100%,rgb(var(--tint)/.07),transparent_62%)]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_85%_at_0%_0%,rgb(var(--tint)/.12),transparent_60%),radial-gradient(80%_70%_at_100%_100%,rgb(var(--tint)/.1),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span aria-hidden="true" className="pointer-events-none absolute -top-20 -left-16 -z-10 size-48 rounded-full bg-[rgb(var(--tint)/.18)] blur-3xl" />
      {/* light catching the top edge */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--tint)/.9),transparent)]" />

      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--tint)/.16)] text-[rgb(var(--tint))] ring-1 ring-[rgb(var(--tint)/.3)] transition-colors group-hover:bg-[rgb(var(--tint))] group-hover:text-route-ink">
              <TypeGlyph skill={isSkill} />
            </span>
            <span className="truncate text-[.72rem] font-semibold tracking-[.06em] text-[rgb(var(--tint))] uppercase">
              {isSkill ? "Skill roadmap" : "Career path"}
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {rm.years && <span className="hidden font-mono text-[.72rem] text-muted xl:inline">{rm.years}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(90deg,rgba(255,90,0,.18),rgba(255,90,0,.08))] px-2.5 py-1 text-[.68rem] font-semibold tracking-wide text-[#FF8A4C] ring-1 ring-highlight/30">
              <StarIcon />
              Featured
            </span>
          </span>
        </div>

        <div className="grid gap-1.5">
          <h3 className={"m-0 font-display leading-tight font-bold tracking-[-.02em] " + (size === "lg" ? "text-[1.45rem]" : "text-[1.32rem]")}>{rm.title}</h3>
          <p className="m-0 line-clamp-2 text-[.88rem] leading-relaxed text-muted">{rm.tagline}</p>
        </div>
      </div>

      <div className="grid gap-3.5">
        {started ? <ProgressLine pct={pct} /> : <PhaseDots count={rm.phases} />}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[.72rem] text-muted">
            <span className="rounded-md bg-sunk/70 px-2 py-0.5"><b className="font-semibold text-ink">{rm.phases}</b> phases</span>
            <span className="rounded-md bg-sunk/70 px-2 py-0.5"><b className="font-semibold text-ink">{rm.topics}</b> topics</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[rgb(var(--tint)/.12)] px-3 py-1.5 text-[.85rem] font-semibold text-[rgb(var(--tint))] transition-colors group-hover:bg-[rgb(var(--tint))] group-hover:text-route-ink">
            {started ? "Continue" : "Start"}
            <span className="transition-transform duration-200 group-hover:translate-x-0.5"><Arrow size={15} /></span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** A tiny route: one dot per phase on a line, first stop lit; the line fills on hover. */
function PhaseDots({ count }: { count: number }) {
  const n = Math.min(count, 16);
  return (
    <div className="relative flex items-center justify-between" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-line" />
      <span className="absolute top-1/2 left-0 h-[2px] w-0 -translate-y-1/2 rounded-full bg-[rgb(var(--tint))] transition-[width] duration-500 ease-out group-hover:w-full" />
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          style={{ transitionDelay: `${Math.round((i / Math.max(n - 1, 1)) * 400)}ms` }}
          className={"relative size-2.5 rounded-full border-2 transition-colors duration-200 " +
            (i === 0 ? "border-[rgb(var(--tint))] bg-[rgb(var(--tint))] shadow-[0_0_0_3px_rgb(var(--tint)/.2)]" : "border-[#475569] bg-surface group-hover:border-[rgb(var(--tint))]")}
        />
      ))}
    </div>
  );
}

function ProgressLine({ pct }: { pct: number }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-[.8rem]">
        <span className="text-muted">Your progress</span>
        <span className="font-mono font-medium text-done">{pct === 100 ? "Done" : `${pct}%`}</span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Your progress">
        <i className="block h-full rounded-full bg-done" style={{ width: Math.max(pct, 3) + "%" }} />
      </span>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2.8 2.8 5.7 6.3.9-4.55 4.43 1.08 6.27L12 17.14l-5.63 2.96 1.08-6.27L2.9 9.4l6.3-.91L12 2.8Z" />
    </svg>
  );
}

/** Route glyph for career paths, code glyph for skills. */
export function TypeGlyph({ skill, size = 19 }: { skill: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {skill
        ? <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
        : <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3" /></>}
    </svg>
  );
}
