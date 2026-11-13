import Link from "next/link";
import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { SignupsChart } from "@/components/admin/SignupsChart";
import { adminInsights, type Insights } from "@/lib/adminInsights";
import { checkAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Overview" };

/** Admin home: who is signing up, who is active, which roadmaps are used, and where learners need videos. */
export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted" aria-busy="true">Loading…</div>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate check={check} />;
  const res = await adminInsights();
  if (!res.ok) return res.reason === "no-secret-key" ? <SecretKeySetup /> : <LoadError message={res.message} />;
  const { totals: t, signups, roadmaps, needsVideo } = res.data;

  return (
    <div className="grid gap-8">
      <header className="grid gap-1.5">
        <h1 className="m-0 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-bold tracking-[-.03em]">Overview</h1>
        <p className="m-0 text-muted">How Track My Roadmap is being used. Days follow Bangladesh time; &ldquo;active&rdquo; means ticked a topic or habit.</p>
      </header>

      <dl className="m-0 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Users" value={t.users} note={`+${t.new7} this week · +${t.new1} today`} />
        <Stat label="Active this week" value={t.active7} note={`${t.active1} today · ${t.active30} this month`} />
        <Stat label="Topics ticked" value={t.topicsDone} note={t.users ? `${Math.round(t.topicsDone / t.users)} per user on average` : undefined} />
        <Stat label="Certificates earned" value={t.certificates} note={`${t.habitUsers} use the habit tracker`} />
      </dl>

      <section aria-labelledby="su-h" className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="su-h" className="m-0 text-[1.02rem] font-bold">Sign-ups per day</h2>
          <span className="font-mono text-[.78rem] text-muted">last 30 days · {t.new30} total</span>
        </div>
        <SignupsChart data={signups} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <RoadmapTable rows={roadmaps} />
        <NeedsVideos rows={needsVideo} />
      </div>

      <p className="m-0 text-[.82rem] text-muted">
        <Link href="/admin/users" className="font-semibold text-route hover:underline">See every user →</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <dt className="order-2 text-[.82rem] text-muted">{label}</dt>
      <dd className="order-1 m-0 font-display text-[1.9rem] leading-none font-bold tracking-[-.02em] tabular-nums">{value.toLocaleString("en-US")}</dd>
      {note && <span className="order-3 font-mono text-[.74rem] text-muted">{note}</span>}
    </div>
  );
}

function RoadmapTable({ rows }: { rows: Insights["roadmaps"] }) {
  return (
    <section aria-labelledby="rm-h" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 id="rm-h" className="m-0 text-[1.02rem] font-bold">Roadmaps in use</h2>
        <p className="m-0 mt-0.5 text-[.82rem] text-muted">&ldquo;Most learners are on&rdquo; shows where unfinished learners currently are: the phase to strengthen first.</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[.88rem]">
            <thead>
              <tr className="text-left">
                {["Roadmap", "Learners", "Avg progress", "Completed", "Most learners are on"].map((h) => (
                  <th key={h} scope="col" className="eyebrow border-b border-line px-4 py-2.5 font-medium sm:px-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-semibold sm:px-5">{r.title}</th>
                  <td className="px-4 py-3 font-mono sm:px-5">{r.started}</td>
                  <td className="px-4 py-3 sm:px-5">
                    <span className="flex items-center gap-2">
                      <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-sunk"><i className="block h-full rounded-full bg-route" style={{ width: r.avgPct + "%" }} /></span>
                      <span className="font-mono text-[.8rem] text-muted">{r.avgPct}%</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono sm:px-5">{r.completed}</td>
                  <td className="px-4 py-3 text-[.85rem] text-muted sm:px-5">{r.stuck ? <>Phase {r.stuck.num}: {r.stuck.title} <span className="font-mono">({r.stuck.learners})</span></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="m-0 p-5 text-muted">No one has ticked a topic yet.</p>}
    </section>
  );
}

function NeedsVideos({ rows }: { rows: Insights["needsVideo"] }) {
  return (
    <section aria-labelledby="nv-h" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 id="nv-h" className="m-0 text-[1.02rem] font-bold">Needs a video most</h2>
        <p className="m-0 mt-0.5 text-[.82rem] text-muted">Topics learners are on right now that have no recommended video yet.</p>
      </div>
      {rows.length ? (
        <ol className="m-0 list-none p-0">
          {rows.map((r) => (
            <li key={r.slug + r.key} className="border-b border-line last:border-b-0">
              <Link href={`/admin/videos/${r.slug}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-sunk/40 sm:px-5">
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-[.92rem] font-semibold">{r.topic}</b>
                  <span className="truncate text-[.78rem] text-muted">{r.roadmap}</span>
                </span>
                <span className="font-mono text-[.8rem] whitespace-nowrap text-muted">{r.waiting} {r.waiting === 1 ? "learner" : "learners"}</span>
                <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : <p className="m-0 p-5 text-muted">Every topic learners are on has a video. 🎉</p>}
    </section>
  );
}

function SecretKeySetup() {
  return (
    <div className="grid max-w-[640px] gap-4 rounded-2xl border border-line bg-surface p-6">
      <h1 className="m-0 font-display text-[1.5rem] font-bold">One step to turn on the overview</h1>
      <p className="m-0 text-muted">User numbers come from Supabase&rsquo;s protected user list, which the site reads on the server with a secret key.</p>
      <ol className="m-0 grid gap-2 pl-5 text-[.94rem]">
        <li>Supabase → <b>Project Settings → API Keys</b> → <b>Secret keys</b> → create one (name it &ldquo;server&rdquo;) and copy it.</li>
        <li>Add it to <code className="font-mono text-[.85em]">.env</code> as <code className="font-mono text-[.85em]">SUPABASE_SECRET_KEY=sb_secret_…</code> and restart <code className="font-mono text-[.85em]">npm run dev</code>.</li>
        <li>Add the same variable in <b>Vercel → Settings → Environment Variables</b>, then redeploy.</li>
      </ol>
      <p className="m-0 text-[.85rem] text-muted">Never name it with <code className="font-mono">NEXT_PUBLIC_</code>: that would send it to every visitor&rsquo;s browser.</p>
    </div>
  );
}

function LoadError({ message }: { message?: string }) {
  return (
    <div className="grid max-w-[640px] gap-2 rounded-2xl border border-danger/40 bg-surface p-6">
      <h1 className="m-0 text-[1.2rem] font-bold">Couldn&rsquo;t load the numbers</h1>
      <p className="m-0 text-muted">{message || "Supabase didn’t answer. Try again in a moment."}</p>
    </div>
  );
}

