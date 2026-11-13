import Image from "next/image";

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

/** The app icon, large, with a warm glow behind it (home hero). */
export function HeroArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto grid w-[min(52vw,380px)] place-items-center lg:mr-0">
      <div className="absolute inset-[-14%] rounded-full bg-[radial-gradient(closest-side,rgba(255,138,0,.55),rgba(255,90,0,.18)_55%,transparent_75%)] blur-2xl" />
      <Image src="/brand/icon-560.png" alt="" width={560} height={560} priority sizes="(min-width: 1024px) 380px, 52vw"
        className="relative h-auto w-full drop-shadow-[0_24px_48px_rgba(255,90,0,.35)]" />
    </div>
  );
}

/** Soft, slightly lighter wave shapes behind the hero. */
export function HeroWaves() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 h-full w-full [mask-image:linear-gradient(to_bottom,black_55%,transparent_96%)]" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice">
      <path d="M1440 70C1290 90 1210 250 1120 420S900 690 640 700 180 640 0 690V760H1440Z" fill="#1E293B" opacity=".45" />
      <path d="M1440 360C1330 380 1250 520 1100 600S760 700 520 690 150 650 0 720V760H1440Z" fill="#1E293B" opacity=".55" />
    </svg>
  );
}
