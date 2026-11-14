import Image, { getImageProps } from "next/image";

export type DashPhase = { n: number; t: string; topics: number };

const Tick = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

/**
 * A small, non-interactive example dashboard for a roadmap: the first two phases ticked off, the third in
 * progress, plus today's habits. Uses only phase names and counts, which are public on the overview anyway.
 */
export function HeroDashboard({ title, phases, total, phaseCount }: { title: string; phases: DashPhase[]; total: number; phaseCount: number }) {
  const shown = phases.slice(0, 4);
  const cur = shown[2];
  const curDone = cur ? Math.max(1, Math.round(cur.topics * 0.6)) : 0;
  const done = shown.slice(0, 2).reduce((a, p) => a + p.topics, 0) + curDone;
  const PHASES = shown.map((p, i) => ({
    n: p.n, t: p.t,
    st: (i < 2 ? "done" : i === 2 ? "current" : "next") as "done" | "current" | "next",
    c: i < 2 ? `${p.topics}/${p.topics}` : i === 2 ? `${curDone}/${p.topics}` : `0/${p.topics}`,
  }));
  const next = cur?.t ?? "";
  const pct = total ? done / total : 0, rc = 2 * Math.PI * 26;
  return (
    <div inert aria-hidden="true" className="relative mx-auto w-full max-w-[440px] select-none lg:mr-0">
      <div className="absolute inset-[-12%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(255,138,0,.30),rgba(255,90,0,.08)_60%,transparent_78%)] blur-2xl" />

      <div className="grid gap-5 rounded-[24px] border border-line bg-surface p-5 shadow-[var(--shadow)] sm:p-6">
        {/* header */}
        <div className="flex items-center gap-3">
          <Image src="/brand/icon-128.png" alt="" width={32} height={32} className="rounded-[8px]" />
          <span className="font-display text-[1.05rem] font-bold">Your dashboard</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-done-soft px-2.5 py-1 text-[.75rem] font-semibold text-done">
            <i className="size-1.5 rounded-full bg-done" />Synced
          </span>
        </div>

        {/* progress */}
        <div className="flex items-center gap-4 rounded-[16px] bg-bg p-4">
          <div className="relative size-16 flex-none">
            <svg viewBox="0 0 64 64" className="size-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-sunk" />
              <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-done"
                strokeDasharray={rc.toFixed(2)} strokeDashoffset={(rc * (1 - pct)).toFixed(2)} />
            </svg>
            <b className="absolute inset-0 grid place-items-center font-mono text-[.8rem] font-medium">{Math.round(pct * 100)}%</b>
          </div>
          <div className="grid">
            <span className="eyebrow">{title}</span>
            <span className="font-display text-[1.2rem] font-semibold">{done} of {total} topics</span>
            <span className="text-[.85rem] text-muted">2 of {phaseCount} phases complete</span>
          </div>
        </div>

        {/* phases with check marks */}
        <ol className="m-0 grid list-none gap-1 p-0">
          {PHASES.map((p) => (
            <li key={p.n} className={"flex items-center gap-3 rounded-[12px] px-2.5 py-2 " + (p.st === "current" ? "bg-route-soft" : "")}>
              <span className={"grid size-7 flex-none place-items-center rounded-full font-mono text-[.75rem] font-medium " +
                (p.st === "done" ? "bg-done text-done-ink" : p.st === "current" ? "border-2 border-[#FF5A00] text-[#FF8A00]" : "border-2 border-line text-muted")}>
                {p.st === "done" ? <Tick /> : p.n}
              </span>
              <span className={"min-w-0 flex-1 truncate text-[.92rem] " + (p.st === "done" ? "text-muted line-through decoration-muted/50" : p.st === "current" ? "font-semibold" : "text-muted")}>{p.t}</span>
              {p.st === "current"
                ? <span className="rounded-full bg-[#FF5A00]/15 px-2 py-0.5 text-[.72rem] font-semibold text-[#FF8A00]">You’re here</span>
                : <span className="font-mono text-[.75rem] text-muted">{p.c}</span>}
            </li>
          ))}
        </ol>

        {/* habits */}
        <div className="grid gap-2 border-t border-line pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[.92rem] font-semibold">Today’s habits</span>
            <span className="font-mono text-[.78rem] text-muted">4 of 6</span>
          </div>
          <span className="block h-2 overflow-hidden rounded-full bg-sunk"><i className="block h-full w-2/3 rounded-full bg-done" /></span>
        </div>
      </div>

      {/* a topic just ticked off */}
      <div className="absolute -top-11 right-8 hidden items-center gap-3 rounded-[14px] border border-line bg-bg/95 py-2.5 pr-4 pl-2.5 shadow-[var(--shadow)] sm:flex">
        <span className="grid size-8 place-items-center rounded-full bg-done text-done-ink"><Tick size={15} /></span>
        <span className="grid leading-tight">
          <span className="text-[.82rem] font-semibold">Topic completed</span>
          <span className="max-w-[18ch] truncate text-[.75rem] text-muted">in {next}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Full-bleed mountain + summit-flag artwork behind the hero, art-directed: a wide landscape image from 768px up,
 * a portrait one on phones. On phones the image is pinned full-width to the bottom (its empty sky fading into the
 * page), so the hero's bottom padding (~68vw, see app/page.tsx) keeps the flagged peak clear of the buttons.
 * Scrims keep the copy readable on larger screens and the bottom fades into the next section.
 */
export function HeroBackdrop() {
  const common = { alt: "", sizes: "100vw", fetchPriority: "high", loading: "eager" } as const;
  const { props: { srcSet: wide } } = getImageProps({ ...common, src: "/hero/summit-flag.png", width: 1774, height: 887 });
  const { props: { srcSet: tall, ...img } } = getImageProps({ ...common, src: "/hero/summit-flag-mobile.png", width: 1024, height: 1536 });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <picture>
        <source media="(min-width: 768px)" srcSet={wide} />
        <img {...img} srcSet={tall} alt=""
          className="absolute inset-x-0 -bottom-[14vw] h-auto w-full [mask-image:linear-gradient(to_bottom,transparent,black_40%)]
            md:inset-0 md:bottom-0 md:h-full md:object-cover md:object-[78%_center] md:[mask-image:none]" />
      </picture>
      {/* tablets: text spans the width, so an even tint; desktop: tint only behind the left column */}
      <div className="absolute inset-0 max-md:hidden bg-[rgba(15,23,42,.72)] lg:bg-transparent lg:bg-[linear-gradient(90deg,rgba(15,23,42,.92)_0%,rgba(15,23,42,.75)_38%,rgba(15,23,42,.15)_70%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-band md:h-1/3" />
    </div>
  );
}
