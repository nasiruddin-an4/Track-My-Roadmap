"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "@/components/account/AccountData";
import { Avatar } from "@/components/account/AccountShell";
import { Bar, btnGhost, Loading, PageHead } from "@/components/account/ui";
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
  if (a.status === "loading") return <Loading />;
  const p = a.profile;
  const joined = p.joined ? new Date(p.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;
  const top = [...a.roadmaps].sort((x, y) => y.pct - x.pct).slice(0, 4);

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
        <h2 id="skillsH" className="m-0 font-display text-[1.3rem] font-bold tracking-[-.02em]">Your strongest roadmaps</h2>
        {top.length ? (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {top.map((s) => (
              <li key={s.slug} className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/roadmaps/${s.slug}`} className="truncate font-semibold hover:text-route">{s.title}</Link>
                  <span className="font-mono text-[.8rem] text-muted">{s.pct}%</span>
                </div>
                <Bar pct={s.pct} />
                <span className="text-[.82rem] text-muted">{s.phasesDone} of {s.phaseCount} phases · {s.done} topics</span>
              </li>
            ))}
          </ul>
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

function Chip({ children, tone }: { children: React.ReactNode; tone?: "done" }) {
  return <li className={"rounded-full border px-3 py-1 " + (tone === "done" ? "border-done/30 bg-done-soft text-done" : "border-line bg-bg/50 text-muted")}>{children}</li>;
}
