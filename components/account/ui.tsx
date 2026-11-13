"use client";

import Link from "next/link";
import { timeAgo, type RoadmapStat } from "@/components/account/AccountData";
import { Arrow } from "@/components/icons";

export function PageHead({ title, lead, action }: { title: string; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="m-0 font-display text-[clamp(1.6rem,3.5vw,2.1rem)] leading-tight font-bold tracking-[-.025em]">{title}</h1>
        {lead && <p className="m-0 max-w-[60ch] text-muted">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

export function Stats({ items }: { items: { n: React.ReactNode; l: string; hint?: string }[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-[20px] border border-line bg-line [gap:1px] lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.l} className="grid content-center justify-items-center gap-1 bg-surface px-3 py-6 text-center sm:py-8" title={s.hint}>
          <dd className="m-0 font-display text-[clamp(1.9rem,4vw,2.7rem)] leading-none font-bold tracking-[-.03em] tabular-nums">{s.n}</dd>
          <dt className="text-[.88rem] text-muted">{s.l}</dt>
        </div>
      ))}
    </dl>
  );
}

export function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <span className={"block h-1.5 overflow-hidden rounded-full bg-sunk " + className} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i className={"block h-full rounded-full " + (pct >= 100 ? "bg-done" : "bg-route")} style={{ width: Math.max(pct, 2) + "%" }} />
    </span>
  );
}

/** One started roadmap: progress, where you are, and a way back in. */
export function RoadmapRow({ s }: { s: RoadmapStat }) {
  const finished = s.pct >= 100;
  return (
    <li className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-5">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Link href={`/roadmaps/${s.slug}`} className="truncate font-display text-[1.12rem] font-bold tracking-[-.01em] hover:text-route">{s.title}</Link>
          <span className="font-mono text-[.8rem] text-muted">{s.done}/{s.total} topics · <b className={"font-medium " + (finished ? "text-done" : "text-ink")}>{s.pct}%</b></span>
        </div>
        <Bar pct={s.pct} />
        <p className="m-0 text-[.86rem] text-muted">
          {finished ? <span className="text-done">Completed 🎉</span>
            : s.current ? <>Phase {s.current.num} of {s.phaseCount}: <span className="text-ink">{s.current.title}</span></> : null}
          {s.updatedAt > 0 && <> · updated {timeAgo(s.updatedAt)}</>}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={`/account/card?roadmap=${s.slug}`} title="Share this roadmap’s Road Card"
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-[.9rem] font-semibold whitespace-nowrap text-muted transition hover:border-muted hover:text-ink sm:flex-none">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
          Share card
        </Link>
        <Link href={`/roadmaps/${s.slug}/track`}
          className={"inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-[.92rem] font-semibold whitespace-nowrap transition sm:flex-none " +
            (finished ? "border border-line text-ink hover:border-muted" : "bg-route text-route-ink hover:brightness-110")}>
          {finished ? "Review" : "Continue"} <Arrow size={15} />
        </Link>
      </div>
    </li>
  );
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[20px] border border-dashed border-line px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface text-muted">
        {icon ?? <SignpostIcon />}
      </span>
      <h2 className="m-0 font-display text-[1.4rem] font-bold tracking-[-.02em]">{title}</h2>
      {children && <p className="m-0 max-w-[46ch] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-surface" />
      <div className="h-32 animate-pulse rounded-[20px] bg-surface" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}

export function OfflineNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="m-0 mb-4 rounded-xl border border-warm/40 bg-warm/10 px-3.5 py-2.5 text-[.9rem] text-warm">Couldn’t reach your account just now, so this shows the progress saved on this device.</p>;
}

export const btnPrimary = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-route px-4 text-[.92rem] font-semibold whitespace-nowrap text-route-ink transition hover:brightness-110";
export const btnGhost = "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line px-4 text-[.92rem] font-semibold whitespace-nowrap text-ink transition hover:border-muted";

function SignpostIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M7 6h10l2.5 2.5L17 11H7l-2.5-2.5L7 6Z" />
    </svg>
  );
}
