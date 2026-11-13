import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HeroDashboard } from "@/components/home/HeroArt";
import { Check, Loop } from "@/components/icons";
import { PhaseLinkRedirect } from "@/components/roadmap/PhaseLinkRedirect";
import { StartButton } from "@/components/roadmap/StartButton";
import { SiteFooter } from "@/components/SiteFooter";
import { ROADMAPS } from "@/content/roadmaps";
import { getRoadmap } from "@/content/roadmaps";
import { pageMeta } from "@/lib/site";
import { computeProgress, phaseHighlights, progressUnits, topicCount, type Phase } from "@/lib/roadmap";

export function generateStaticParams() {
  return ROADMAPS.map((r) => ({ slug: r.def.slug }));
}

export async function generateMetadata({ params }: PageProps<"/roadmaps/[slug]">): Promise<Metadata> {
  const rm = getRoadmap((await params).slug);
  if (!rm) return { title: "Page not found", robots: { index: false } };
  const { def } = rm;
  const title = `${def.title} Roadmap${def.years ? " " + def.years : ""}`;
  const about = def.tagline.charAt(0).toLowerCase() + def.tagline.slice(1).replace(/\.$/, "");
  let description = `Free ${def.title} roadmap${def.years ? ` for ${def.years}` : ""}: ${rm.numbered.length} phases and ${topicCount(rm)} topics, ${about}.`;
  if (description.length < 130) description += " Track your progress with Google.";
  return pageMeta(title, description, `/roadmaps/${def.slug}`);
}

/** Public overview of a roadmap: what it covers, phase by phase, and a button to start tracking. */
export default function RoadmapOverviewPage({ params }: PageProps<"/roadmaps/[slug]">) {
  // the slug comes from the URL, so read it inside Suspense; the skeleton shows instantly on navigation
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <RoadmapOverview params={params} />
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <div className="wrap animate-pulse pt-8" aria-busy="true" aria-label="Loading roadmap">
      <div className="h-4 w-40 rounded bg-sunk" />
      <div className="grid gap-10 pt-8 pb-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <div className="h-6 w-28 rounded-full bg-sunk" />
          <div className="h-24 max-w-[560px] rounded-2xl bg-sunk" />
          <div className="h-5 max-w-[480px] rounded bg-sunk" />
          <div className="h-12 w-44 rounded-xl bg-sunk" />
        </div>
        <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[18px] bg-surface" />)}</div>
      </div>
    </div>
  );
}

async function RoadmapOverview({ params }: { params: PageProps<"/roadmaps/[slug]">["params"] }) {
  const rm = getRoadmap((await params).slug);
  if (!rm) notFound();
  const { def } = rm;
  const tallies = computeProgress(rm, new Set(), false).tallies;
  const units = progressUnits(rm);
  const topics = topicCount(rm);
  const facts: [string, string][] = [
    [`${rm.numbered.length}`, "phases"],
    [`${topics}`, "topics"],
    [def.level, ""],
    ["Free", ""],
  ];

  return (
    <>
      <PhaseLinkRedirect slug={def.slug} />

      {/* hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute -top-40 right-[-10%] -z-10 size-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(255,138,0,.16),transparent)] blur-2xl" />
        <div className="wrap pt-8 pb-14 sm:pb-16">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[.9rem] text-muted">
            <Link href="/roadmaps" className="hover:text-ink">Roadmaps</Link>
            <span aria-hidden="true">›</span>
            <span className="text-ink">{def.title}</span>
          </nav>
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-route-soft px-3 py-1 text-[.8rem] font-semibold text-route">{def.category}</span>
            {def.years && <span className="rounded-full border border-line px-3 py-1 font-mono text-[.78rem] text-muted">{def.years}</span>}
          </div>
          <h1 className="m-0 max-w-[16ch] font-display text-[clamp(2.5rem,5.6vw,4.2rem)] leading-[1] font-bold tracking-[-.04em] text-balance">
            {def.title} <span className="text-highlight">roadmap</span>
          </h1>
          <p className="m-0 max-w-[54ch] text-[clamp(1.08rem,1.6vw,1.25rem)] leading-relaxed text-muted">{def.tagline}</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="At a glance">
            {facts.map(([n, l]) => (
              <li key={n + l} className="rounded-full bg-surface px-3.5 py-1.5 text-[.9rem] ring-1 ring-line">
                <b className="font-semibold">{n}</b>{l && <span className="text-muted"> {l}</span>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <StartButton slug={def.slug} localKey={def.localKey} units={units} note={false} />
            <a href="#route" className="inline-flex items-center gap-1.5 font-semibold text-muted hover:text-ink">See the route <span aria-hidden="true">↓</span></a>
          </div>
          </div>
          <div className="pt-6 lg:pt-0">
            <HeroDashboard title={def.title} total={topics} phaseCount={rm.numbered.length}
              phases={rm.numbered.slice(0, 4).map((ph) => ({ n: ph.num!, t: ph.title, topics: tallies[ph.id].t }))} />
          </div>
          </div>
        </div>
      </section>

      {/* route + sticky start card */}
      <div className="wrap grid gap-12 pt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <div className="min-w-0">
          <section id="route" aria-labelledby="routeH" className="scroll-mt-24">
            <div className="grid gap-3">
              <span className="eyebrow">The route</span>
              <h2 id="routeH" className="m-0 font-display text-[clamp(1.8rem,4vw,2.5rem)] leading-[1.05] font-bold tracking-[-.03em]">
                {rm.numbered.length} phases, from first steps to job-ready
              </h2>
              <p className="m-0 text-muted">A preview of each phase. Sign in and start the roadmap to see every topic.</p>
            </div>
            <ol className="m-0 mt-8 grid list-none p-0">
              {rm.numbered.map((ph, i) => <PhaseRow key={ph.id} ph={ph} topics={tallies[ph.id].t} last={i === rm.numbered.length - 1} />)}
            </ol>
          </section>

          {rm.ongoing.length > 0 && (
            <section aria-labelledby="ongH" className="pt-12">
              <div className="grid gap-3">
                <span className="eyebrow">Alongside every phase</span>
                <h2 id="ongH" className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">Habits to keep going the whole way</h2>
              </div>
              <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:grid-cols-2">
                {rm.ongoing.map((ph) => {
                  return (
                    <li key={ph.id} className="grid content-start gap-3 rounded-[18px] border border-line bg-surface p-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 flex-none place-items-center rounded-full border-2 border-cont text-cont"><Loop /></span>
                        <h3 className="m-0 font-display text-[1.15rem] font-bold">{ph.title}</h3>
                        <span className="ml-auto font-mono text-[.78rem] text-muted">{tallies[ph.id].t} habits</span>
                      </div>
                      <p className="m-0 text-[.95rem] text-muted">{ph.description}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside aria-label="Start this roadmap" className="hidden lg:block">
          <div className="sticky top-[calc(var(--top)+24px)] grid gap-5 rounded-[22px] border border-line bg-surface p-6">
            <div className="grid gap-1">
              <span className="eyebrow">Start this roadmap</span>
              <span className="font-display text-[1.35rem] leading-tight font-bold">{def.title}</span>
            </div>
            <dl className="m-0 grid grid-cols-2 gap-2.5">
              <Stat n={rm.numbered.length} l="phases" />
              <Stat n={topics} l="topics" />
            </dl>
            <ul className="m-0 grid list-none gap-2 p-0 text-[.92rem] text-muted">
              {BENEFITS.map((x) => <li key={x} className="flex items-start gap-2"><span className="mt-1 text-done"><Check size={14} /></span>{x}</li>)}
            </ul>
            <StartButton slug={def.slug} localKey={def.localKey} units={units} note={false} />
          </div>
        </aside>
      </div>

      {/* start (phones and tablets; the sticky card covers desktop) */}
      <div className="wrap lg:hidden">
        <section className="mt-14 grid gap-5 rounded-[24px] border border-line bg-surface p-7">
          <h2 className="m-0 font-display text-[1.8rem] leading-tight font-bold tracking-[-.03em]">Ready to start?</h2>
          <ul className="m-0 grid list-none gap-2 p-0 text-muted">
            {BENEFITS.map((x) => <li key={x} className="flex items-start gap-2"><span className="mt-1 text-done"><Check size={14} /></span>{x}</li>)}
          </ul>
          <StartButton slug={def.slug} localKey={def.localKey} units={units} note={false} />
        </section>
      </div>

      <SiteFooter note={def.credit?.text} />
    </>
  );
}

const BENEFITS = ["Tick off topics as you learn them", "Always see what to learn next", "Saved to your Google account"];

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="grid gap-0.5 rounded-[14px] bg-bg p-3.5">
      <dt className="order-2 text-[.82rem] text-muted">{l}</dt>
      <dd className="order-1 m-0 font-display text-[1.6rem] leading-none font-bold tracking-[-.03em] tabular-nums">{n}</dd>
    </div>
  );
}

/** One phase on the timeline: a preview only (a few sample topics); the full list is in the tracker after sign-in. */
function PhaseRow({ ph, topics, last }: { ph: Phase; topics: number; last: boolean }) {
  const h = phaseHighlights(ph, PREVIEW);
  const first = ph.num === 1;
  return (
    <li className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 pb-4 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-5">
      {!last && <span aria-hidden="true" className="absolute top-12 -bottom-0 left-[19px] w-0.5 rounded bg-line sm:left-[23px]" />}
      <span className={"relative mt-4 grid size-10 place-items-center rounded-full border-2 font-mono text-[.9rem] font-medium sm:size-12 " +
        (first ? "border-route bg-route text-route-ink shadow-[0_0_0_4px_var(--route-soft)]" : "border-line bg-bg text-muted")}>
        {ph.num}
      </span>
      <div className="grid min-w-0 gap-2 rounded-[18px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="eyebrow">Phase {String(ph.num).padStart(2, "0")}</span>
          <span className="font-mono text-[.78rem] text-muted">{topics} topics</span>
        </div>
        <h3 className="m-0 font-display text-[1.3rem] leading-tight font-bold tracking-[-.02em]">{ph.title}</h3>
        <p className="m-0 max-w-[62ch] text-[.95rem] text-muted">{ph.description}</p>
        <Chips items={h.items} more={h.more} />
      </div>
    </li>
  );
}

/** How many sample topics a phase shows before sign-in. */
const PREVIEW = 3;

function Chips({ items, more }: { items: string[]; more: number }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 pt-1">
      {items.map((x) => <li key={x} className="rounded-full border border-line bg-bg px-2.5 py-0.5 text-[.82rem]">{x}</li>)}
      {more > 0 && (
        <li className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[.82rem] text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          +{more} more · sign in to see all
        </li>
      )}
    </ul>
  );
}
