"use client";

import Link from "next/link";
import { timeAgo, useAccount } from "@/components/account/AccountData";
import { btnGhost, btnPrimary, Empty, Loading, OfflineNote, PageHead, RoadmapRow, Stats } from "@/components/account/ui";
import { Arrow } from "@/components/icons";

export function ActivityView() {
  const a = useAccount();
  if (a.status === "loading") return <Loading />;
  const h = a.habits;

  return (
    <>
      <PageHead title={`Hi, ${a.profile.firstName} 👋`}
        lead={a.lastActive ? <>Here’s how your learning is going. Last active {timeAgo(a.lastActive)}.</> : "Here’s where your learning progress will show up."} />
      <OfflineNote show={a.offline} />

      <Stats items={[
        { n: a.topicsDone, l: "Topics completed" },
        { n: a.inProgress.length, l: "Currently learning" },
        { n: a.completed.length, l: "Roadmaps finished" },
        { n: `${h.streak}d`, l: "Habit streak", hint: h.best ? `Best streak: ${h.best} days` : undefined },
      ]} />

      <section className="mt-10 grid gap-4" aria-labelledby="contH">
        <div className="flex items-end justify-between gap-3">
          <h2 id="contH" className="m-0 font-display text-[1.3rem] font-bold tracking-[-.02em]">Continue learning</h2>
          {a.roadmaps.length > 3 && <Link href="/account/roadmaps" className="text-[.9rem] font-semibold text-route hover:underline">All your roadmaps</Link>}
        </div>
        {a.roadmaps.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {(a.inProgress.length ? a.inProgress : a.roadmaps).slice(0, 3).map((s) => <RoadmapRow key={s.slug} s={s} />)}
          </ul>
        ) : (
          <Empty title="No progress yet" action={<Link href="/roadmaps" className={btnPrimary}>Browse roadmaps <Arrow size={15} /></Link>}>
            Progress will appear here as you start ticking off topics on a roadmap.
          </Empty>
        )}
      </section>

      <section className="mt-10 grid gap-4" aria-labelledby="habH">
        <h2 id="habH" className="m-0 font-display text-[1.3rem] font-bold tracking-[-.02em]">Daily habits</h2>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          {h.started ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <Mini n={`${h.today}/${h.total}`} l="done today" />
              <Mini n={`${h.streak} ${h.streak === 1 ? "day" : "days"}`} l="current streak" />
              <Mini n={`${h.best} ${h.best === 1 ? "day" : "days"}`} l="best streak" />
            </div>
          ) : (
            <p className="m-0 max-w-[48ch] text-muted">Build a routine next to your roadmap: tick off daily habits and watch your streak grow.</p>
          )}
          <Link href="/habits/track" className={h.started ? btnGhost : btnPrimary}>{h.started ? "Open habit tracker" : "Start tracking habits"} <Arrow size={15} /></Link>
        </div>
      </section>
    </>
  );
}

function Mini({ n, l }: { n: string; l: string }) {
  return (
    <div className="grid gap-0.5">
      <b className="font-display text-[1.35rem] leading-none tabular-nums">{n}</b>
      <span className="text-[.84rem] text-muted">{l}</span>
    </div>
  );
}
