import Link from "next/link";
import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { roadmapSummaries } from "@/lib/adminData";
import { checkAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Dashboard" };

/** Admin home: totals, then every roadmap with how many of its topics have a recommended video. */
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted" aria-busy="true">Loading…</div>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate check={check} />;
  const rows = await roadmapSummaries();
  const links = rows.reduce((a, r) => a + r.resources, 0);
  const covered = rows.reduce((a, r) => a + r.topics, 0);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const started = rows.filter((r) => r.topics > 0).length;
  const complete = rows.filter((r) => r.total > 0 && r.topics === r.total).length;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return (
    <div className="grid gap-8">
      <header className="grid gap-1.5">
        <h1 className="m-0 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-bold tracking-[-.03em]">Dashboard</h1>
        <p className="m-0 max-w-[64ch] text-muted">
          Add the best YouTube video, playlist or channel for each topic. Learners see them right under the topic in their tracker.
        </p>
      </header>

      <dl className="m-0 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Recommended links" value={links} />
        <Stat label="Topics covered" value={covered} of={total} note={`${pct(covered, total)}% of all topics`} />
        <Stat label="Roadmaps started" value={started} of={rows.length} />
        <Stat label="Roadmaps fully covered" value={complete} of={rows.length} />
      </dl>

      <section aria-labelledby="rm-h" className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id="rm-h" className="m-0 text-[1.02rem] font-bold">Roadmaps</h2>
          <span className="font-mono text-[.78rem] text-muted">{rows.length}</span>
        </div>
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_90px_70px_24px] gap-4 border-b border-line px-5 py-2.5 md:grid">
          {["Roadmap", "Type", "Coverage", "Topics", "Links", ""].map((h) => <span key={h} className="eyebrow">{h}</span>)}
        </div>
        <ul className="m-0 list-none p-0">
          {rows.map((r) => {
            const p = pct(r.topics, r.total);
            return (
              <li key={r.slug} className="border-b border-line last:border-b-0">
                <Link href={`/admin/${r.slug}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-sunk/40 sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_90px_70px_24px]">
                  <b className="truncate font-semibold">{r.title}</b>
                  <span className="hidden truncate text-[.85rem] text-muted md:block">{r.category}</span>
                  <span className="col-span-2 flex items-center gap-3 md:col-span-1">
                    <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                      <i className={"block h-full rounded-full " + (p === 100 ? "bg-done" : "bg-warm")} style={{ width: p + "%" }} />
                    </span>
                    <span className="w-9 text-right font-mono text-[.78rem] text-muted">{p}%</span>
                  </span>
                  <span className="order-2 font-mono text-[.8rem] text-muted md:order-none">{r.topics}/{r.total}</span>
                  <span className="hidden font-mono text-[.8rem] text-muted md:block">{r.resources}</span>
                  <span aria-hidden="true" className="hidden text-muted transition-transform group-hover:translate-x-0.5 md:block">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, of, note }: { label: string; value: number; of?: number; note?: string }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <dt className="order-2 text-[.82rem] text-muted">{label}</dt>
      <dd className="order-1 m-0 font-display text-[1.7rem] leading-none font-bold tracking-[-.02em] tabular-nums">
        {value.toLocaleString("en-US")}
        {of !== undefined && <span className="text-[1rem] font-semibold text-muted"> / {of.toLocaleString("en-US")}</span>}
      </dd>
      {note && <span className="order-3 font-mono text-[.74rem] text-muted">{note}</span>}
    </div>
  );
}
