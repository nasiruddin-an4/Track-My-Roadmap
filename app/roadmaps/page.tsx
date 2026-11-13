import type { Metadata } from "next";
import { RoadmapBrowser } from "@/components/roadmap/RoadmapBrowser";
import { SiteFooter } from "@/components/SiteFooter";
import { COMING_SOON, FEATURED_ROADMAP_SLUGS, ROADMAPS } from "@/content/roadmaps";
import { progressUnits, topicCount } from "@/lib/roadmap";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "Tech Career Roadmaps",
  "Browse free, step-by-step roadmaps for tech careers like Software Engineer, AI Engineer and Frontend Developer. Track every topic, phase by phase.",
  "/roadmaps",
);

export default function RoadmapsPage() {
  const careers = ROADMAPS.filter((r) => r.def.category === "Career path").length;
  const skills = ROADMAPS.length - careers;
  return (
    <>
      <div className="wrap">
        <header className="relative isolate grid gap-4 pt-12 pb-8 sm:pt-16 sm:pb-10">
          {/* soft highlights behind the heading */}
          <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 -z-10 size-[420px] rounded-full bg-route/15 blur-[110px]" />
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-[38%] -z-10 size-[300px] rounded-full bg-highlight/10 blur-[110px]" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgba(148,163,184,.12)_1px,transparent_1px)] [mask-image:radial-gradient(70%_80%_at_20%_30%,#000,transparent)] bg-[size:22px_22px]" />
          <span className="eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 backdrop-blur">
            <span className="size-1.5 rounded-full bg-done shadow-[0_0_0_3px_rgba(67,211,153,.2)]" />
            Free · Browse without an account
          </span>
          <h1 className="m-0 font-display text-[clamp(2.3rem,5.4vw,3.6rem)] leading-[1.02] font-bold tracking-[-.035em]">
            Find your <span className="text-highlight">roadmap</span>
          </h1>
          <p className="m-0 max-w-[58ch] text-[1.08rem] leading-relaxed text-muted">
            Each roadmap breaks a career or skill into phases and topics. Pick one and tick off what you’ve learned as you go.
          </p>
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0 text-[.85rem]">
            <Stat n={ROADMAPS.length} l="roadmaps" />
            <Stat n={careers} l="career paths" href="#career-paths" dot="bg-route" />
            <Stat n={skills} l="skills" href="#skills" dot="bg-warm" />
          </ul>
        </header>
        <RoadmapBrowser
          comingSoon={COMING_SOON}
          roadmaps={ROADMAPS.map((rm) => ({
            slug: rm.def.slug,
            title: rm.def.title,
            tagline: rm.def.tagline,
            category: rm.def.category,
            level: rm.def.level,
            years: rm.def.years,
            phases: rm.numbered.length,
            topics: topicCount(rm),
            featured: FEATURED_ROADMAP_SLUGS.includes(rm.def.slug),
            keywords: rm.phases.map((p) => p.title).join(" "),
            localKey: rm.def.localKey,
            units: progressUnits(rm),
          }))}
        />
      </div>
      <SiteFooter />
    </>
  );
}

function Stat({ n, l, href, dot }: { n: number; l: string; href?: string; dot?: string }) {
  const body = <>{dot && <span aria-hidden="true" className={"size-1.5 self-center rounded-full " + dot} />}<b className="font-mono font-medium text-ink">{n}</b> {l}</>;
  const cls = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-muted backdrop-blur";
  return (
    <li>
      {href
        ? <a href={href} className={cls + " transition-colors hover:border-route hover:text-ink"}>{body}{" "}<span aria-hidden="true" className="text-muted/70">↓</span></a>
        : <span className={cls}>{body}</span>}
    </li>
  );
}
