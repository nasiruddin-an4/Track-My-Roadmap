"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, type RoadmapStat } from "@/components/account/AccountData";
import { Avatar } from "@/components/account/AccountShell";
import { btnGhost, Loading, PageHead } from "@/components/account/ui";
import { useAuth } from "@/components/auth";

export function ProfileView() {
  const a = useAccount();
  // the CV Builder card names the primary CV; quietly falls back to the plain card if the list can't load
  const [cvs, setCvs] = useState<{ title: string; isPrimary: boolean }[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/cv", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setCvs(j.cvs); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const primaryCv = cvs?.find((c) => c.isPrimary);
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (a.status === "loading") return <Loading />;
  const p = a.profile;
  const joined = p.joined ? new Date(p.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;
  // finished skills first, then the furthest along
  const skills = [...a.roadmaps].sort((x, y) => Number(y.complete) - Number(x.complete) || y.pct - x.pct);

  return (
    <>
      <PageHead title="Profile" lead="Your account details and learning at a glance." />

      <section className="relative isolate overflow-hidden rounded-[22px] border border-line bg-surface">
        <div className="h-24 bg-[linear-gradient(120deg,rgba(124,149,255,.35),rgba(255,90,0,.22))] sm:h-28" aria-hidden="true" />
        <div className="grid gap-4 px-5 pb-6 sm:px-7">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <Avatar profile={p} size={88} className="ring-4 ring-surface" />
            <Link href="/account/card" className={btnGhost}>View Road Card</Link>
          </div>
          <div className="grid gap-1">
            <h2 className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">{p.name}</h2>
            <p className="m-0 break-all text-muted">{p.email}</p>
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-[.85rem]">
            {joined && <Chip>Member since {joined}</Chip>}
            {p.provider && <Chip>Signed in with {p.provider}</Chip>}
            <Chip>{a.roadmaps.length} {a.roadmaps.length === 1 ? "roadmap" : "roadmaps"} started</Chip>
            {a.completed.length > 0 && <Chip tone="done">{a.completed.length} completed</Chip>}
          </ul>
        </div>
      </section>

      <Link href="/cv" className="group mt-4 flex items-center gap-4 rounded-[20px] border border-line bg-surface p-5 transition-colors hover:border-highlight">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[rgba(255,90,0,.12)] text-highlight" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2.5h8.5L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z" /><path d="M14 2.5V7h5M8.5 12h7M8.5 15.5h7M8.5 8.5h3" />
          </svg>
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="font-display text-[1.1rem]">CV Builder</b>
          <span className="truncate text-[.9rem] text-muted">
            {primaryCv ? <>Primary CV: <span className="text-ink">{primaryCv.title}</span>{cvs && cvs.length > 1 ? ` · ${cvs.length} CVs` : ""}</>
              : cvs?.length ? `${cvs.length} ${cvs.length === 1 ? "CV" : "CVs"} · open to edit or make one your primary CV`
              : "Make an ATS-friendly CV and download it as a PDF."}
          </span>
        </span>
        <span className="font-semibold text-highlight transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
      </Link>

      <section className="mt-8 grid gap-4" aria-labelledby="skillsH">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="skillsH" className="m-0 font-display text-[1.3rem] font-bold tracking-[-.02em]">Your skills</h2>
            <p className="m-0 text-[.92rem] text-muted">What you’ve learned, roadmap by roadmap.</p>
          </div>
          {skills.length > 0 && <Link href="/account/roadmaps" className="text-[.92rem] font-semibold text-route hover:underline">Manage roadmaps</Link>}
        </div>
        {skills.length ? (
          <>
            <dl className="m-0 grid grid-cols-3 gap-2 sm:gap-3">
              <Stat n={skills.length} l={skills.length === 1 ? "skill started" : "skills started"} />
              <Stat n={a.completed.length} l="completed" tone="done" />
              <Stat n={a.topicsDone} l="topics learned" />
            </dl>
            {a.completed.length > 0 && (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Completed skills">
                {a.completed.map((s) => (
                  <li key={s.slug} className="inline-flex items-center gap-1.5 rounded-full border border-done/35 bg-done-soft px-3 py-1 text-[.86rem] font-semibold text-done">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    {s.title}
                  </li>
                ))}
              </ul>
            )}
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
              {(showAll ? skills : skills.slice(0, 6)).map((s) => <SkillCard key={s.slug} s={s} />)}
            </ul>
            {skills.length > 6 && (
              <button type="button" onClick={() => setShowAll(!showAll)} className={btnGhost + " w-fit"}>
                {showAll ? "Show fewer" : `Show all ${skills.length} skills`}
              </button>
            )}
          </>
        ) : (
          <p className="m-0 rounded-2xl border border-dashed border-line p-5 text-muted">
            Nothing yet. <Link href="/roadmaps" className="font-semibold text-route hover:underline">Pick a roadmap</Link> and your progress shows up here.
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-5" aria-labelledby="acctH">
        <h2 id="acctH" className="m-0 font-display text-[1.15rem] font-bold">Account</h2>
        <p className="m-0 text-[.92rem] text-muted">
          Your roadmaps and habits are saved to this account and load on any device where you sign in.
          Your name and photo come from {p.provider ?? "your sign-in provider"}; change them there and they update here next time you sign in.
        </p>
        <div>
          <button type="button" disabled={busy} onClick={() => { setBusy(true); signOut(); }}
            className="inline-flex h-10 items-center rounded-xl border border-danger/40 px-4 text-[.92rem] font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60">
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    </>
  );
}

function Stat({ n, l, tone }: { n: number; l: string; tone?: "done" }) {
  return (
    <div className="grid content-center gap-1 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <dt className="order-2 text-[.78rem] leading-snug text-muted sm:text-[.84rem]">{l}</dt>
      <dd className={"order-1 m-0 font-display text-[1.4rem] leading-none font-bold tabular-nums sm:text-[1.7rem] " + (tone === "done" ? "text-done" : "")}>{n}</dd>
    </div>
  );
}

const RING = 2 * Math.PI * 22;

/** One skill: how much of it is done, topic by topic and phase by phase. */
function SkillCard({ s }: { s: RoadmapStat }) {
  const frac = Math.min(1, s.total ? s.done / s.total : 0);
  const states = s.phaseStates.split("");
  return (
    <li className={"grid gap-3 rounded-2xl border p-4 " + (s.complete ? "border-done/35 bg-[linear-gradient(135deg,var(--done-soft),var(--surface)_70%)]" : "border-line bg-surface")}>
      <div className="flex items-center gap-3.5">
        <div className="relative size-14 flex-none" aria-hidden="true">
          <svg viewBox="0 0 52 52" className="size-full -rotate-90">
            <circle cx="26" cy="26" r="22" fill="none" strokeWidth="6" className="stroke-sunk" />
            <circle cx="26" cy="26" r="22" fill="none" strokeWidth="6" strokeLinecap="round" className={s.complete ? "stroke-done" : "stroke-route"}
              strokeDasharray={RING.toFixed(2)} strokeDashoffset={(RING * (1 - frac)).toFixed(2)} />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-mono text-[.72rem] font-semibold">
            {s.complete ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-done"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : `${s.pct}%`}
          </span>
        </div>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-[.72rem] font-semibold tracking-[.04em] text-muted uppercase">{s.category}</span>
          <Link href={`/roadmaps/${s.slug}/track`} className="truncate font-display text-[1.1rem] font-bold tracking-[-.01em] hover:text-route">{s.title}</Link>
          <span className={"text-[.9rem] font-semibold " + (s.complete ? "text-done" : "text-ink")}>
            {s.complete ? "Completed" : `${s.pct}% complete`}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        {/* one block per phase: green done, blue started, grey not started */}
        <div className="flex gap-[3px]" role="img" aria-label={`${s.phasesDone} of ${s.phaseCount} phases complete`}>
          {states.map((c, i) => (
            <span key={i} title={`Phase ${i + 1}: ${c === "d" ? "complete" : c === "s" ? "in progress" : "not started"}`}
              className={"h-2 flex-1 rounded-full " + (c === "d" ? "bg-done" : c === "s" ? "bg-route/70" : "bg-sunk")} />
          ))}
        </div>
        <span className="flex flex-wrap justify-between gap-x-3 text-[.82rem] text-muted">
          <span><b className="font-semibold text-ink">{s.done}</b> of {s.total} topics</span>
          <span>{s.phasesDone}/{s.phaseCount} phases</span>
        </span>
      </div>
      <p className="m-0 border-t border-line pt-2.5 text-[.84rem] text-muted">
        {s.complete ? (s.completedAt ? `Finished ${new Date(s.completedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : "Every phase finished")
          : s.current ? <>Now on Phase {s.current.num}: <span className="text-ink">{s.current.title}</span></> : null}
      </p>
    </li>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "done" }) {
  return <li className={"rounded-full border px-3 py-1 " + (tone === "done" ? "border-done/30 bg-done-soft text-done" : "border-line bg-bg/50 text-muted")}>{children}</li>;
}
