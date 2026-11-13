"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "@/components/account/AccountData";
import { btnPrimary, Empty, Loading, OfflineNote, PageHead, RoadmapRow } from "@/components/account/ui";
import { Arrow } from "@/components/icons";

export function RoadmapsView() {
  const a = useAccount();
  const [tab, setTab] = useState<"progress" | "done">("progress");
  if (a.status === "loading") return <Loading />;
  const list = tab === "progress" ? a.inProgress : a.completed;

  return (
    <>
      <PageHead title="Your roadmaps" lead="Every roadmap you’ve started, most recent first."
        action={<Link href="/roadmaps" className="text-[.92rem] font-semibold text-route hover:underline">Find a new roadmap</Link>} />
      <OfflineNote show={a.offline} />

      {a.roadmaps.length === 0 ? (
        <Empty title="You haven’t started a roadmap yet" action={<Link href="/roadmaps" className={btnPrimary}>Browse roadmaps <Arrow size={15} /></Link>}>
          Open any roadmap and tick off a topic. It will show up here with your progress.
        </Empty>
      ) : (
        <>
          <div role="tablist" aria-label="Roadmaps" className="mb-4 inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
            {([["progress", "In progress", a.inProgress.length], ["done", "Completed", a.completed.length]] as const).map(([v, l, n]) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                className={"flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[.88rem] font-semibold transition-colors " +
                  (tab === v ? "bg-route text-route-ink" : "text-muted hover:text-ink")}>
                {l} <span className={"font-mono text-[.72rem] " + (tab === v ? "text-route-ink/70" : "")}>{n}</span>
              </button>
            ))}
          </div>
          {list.length ? (
            <ul className="m-0 grid list-none gap-3 p-0">{list.map((s) => <RoadmapRow key={s.slug} s={s} />)}</ul>
          ) : (
            <p className="m-0 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
              {tab === "done" ? "No finished roadmaps yet. Keep going, you’ve got this!" : "Everything you started is finished. Time to pick a new one?"}
            </p>
          )}
        </>
      )}
    </>
  );
}
