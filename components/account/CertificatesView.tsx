"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAccount, type RoadmapStat } from "@/components/account/AccountData";
import { Bar, btnPrimary, Empty, Loading, PageHead } from "@/components/account/ui";
import { clip, downloadSvgAsPng, fileSlug } from "@/components/account/svgExport";
import { Arrow } from "@/components/icons";

export function CertificatesView() {
  const a = useAccount();
  if (a.status === "loading") return <Loading />;
  const closest = [...a.inProgress].sort((x, y) => y.pct - x.pct).slice(0, 3);

  return (
    <>
      <PageHead title="Certificates" lead="Finish every topic in a roadmap to earn a certificate you can download and share." />
      {a.completed.length ? (
        <ul className="m-0 grid list-none gap-6 p-0 xl:grid-cols-2">
          {a.completed.map((s) => <li key={s.slug}><Certificate s={s} name={a.profile.name} /></li>)}
        </ul>
      ) : (
        <Empty title="No certificates yet"
          icon={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" /></svg>}
          action={!closest.length && <Link href="/roadmaps" className={btnPrimary}>Browse roadmaps <Arrow size={15} /></Link>}>
          Complete all the topics in a roadmap and your certificate will appear here.
        </Empty>
      )}

      {closest.length > 0 && (
        <section className="mt-10 grid gap-4" aria-labelledby="nextH">
          <h2 id="nextH" className="m-0 font-display text-[1.3rem] font-bold tracking-[-.02em]">Closest to a certificate</h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {closest.map((s) => (
              <li key={s.slug}>
                <Link href={`/roadmaps/${s.slug}/track`} className="grid h-full gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-route">
                  <b className="truncate">{s.title}</b>
                  <Bar pct={s.pct} />
                  <span className="text-[.84rem] text-muted">{s.total - s.done} topics to go · {s.pct}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Certificate({ s, name }: { s: RoadmapStat; name: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const when = s.completedAt || s.updatedAt; // completion date; older progress without one falls back to the last edit
  const date = when ? new Date(when).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }) : "";
  const W = 1414, H = 1000;

  async function save() {
    if (!svg.current) return;
    setState("busy");
    try { await downloadSvgAsPng(svg.current, `certificate-${fileSlug(s.title)}.png`); setState("idle"); }
    catch { setState("error"); }
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-2xl border border-line shadow-[var(--shadow)]">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Certificate: ${name} completed the ${s.title} roadmap`} className="block h-auto w-full"
          style={{ fontFamily: "var(--display), system-ui, sans-serif" }}>
          <rect width={W} height={H} fill="#FFFDF8" />
          <rect x="36" y="36" width={W - 72} height={H - 72} fill="none" stroke="#0F172A" strokeWidth="3" />
          <rect x="52" y="52" width={W - 104} height={H - 104} fill="none" stroke="#FF5A00" strokeWidth="1.5" />
          <text x={W / 2} y="170" fill="#FF5A00" fontSize="26" fontWeight="700" textAnchor="middle" letterSpacing="6">TRACK MY ROADMAP</text>
          <text x={W / 2} y="270" fill="#0F172A" fontSize="64" fontWeight="700" textAnchor="middle" letterSpacing="4">CERTIFICATE OF COMPLETION</text>
          <text x={W / 2} y="360" fill="#475569" fontSize="28" textAnchor="middle">This certifies that</text>
          <text x={W / 2} y="460" fill="#0F172A" fontSize="76" fontWeight="700" textAnchor="middle">{clip(name, 30)}</text>
          <line x1={W / 2 - 330} y1="495" x2={W / 2 + 330} y2="495" stroke="#CBD5E1" strokeWidth="2" />
          <text x={W / 2} y="565" fill="#475569" fontSize="28" textAnchor="middle">has completed every topic of the</text>
          <text x={W / 2} y="640" fill="#1E2A55" fontSize="52" fontWeight="700" textAnchor="middle">{clip(s.title, 34)} Roadmap</text>
          <text x={W / 2} y="700" fill="#475569" fontSize="26" textAnchor="middle">{s.phaseCount} phases · {s.total} topics</text>

          <g transform={`translate(260 ${H - 170})`}>
            <text x="0" y="0" fill="#0F172A" fontSize="28" fontWeight="600" textAnchor="middle">{date}</text>
            <line x1="-150" y1="18" x2="150" y2="18" stroke="#94A3B8" strokeWidth="1.5" />
            <text x="0" y="52" fill="#64748B" fontSize="22" textAnchor="middle">Date</text>
          </g>
          <g transform={`translate(${W - 260} ${H - 170})`}>
            <text x="0" y="0" fill="#0F172A" fontSize="28" fontWeight="600" textAnchor="middle">trackmyroadmap.com</text>
            <line x1="-150" y1="18" x2="150" y2="18" stroke="#94A3B8" strokeWidth="1.5" />
            <text x="0" y="52" fill="#64748B" fontSize="22" textAnchor="middle">Issued by</text>
          </g>
          {/* seal */}
          <g transform={`translate(${W / 2} ${H - 160})`}>
            <circle r="64" fill="#FF5A00" />
            <circle r="54" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 6" />
            <path d="M-22 2 l14 14 l30 -32" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[.9rem] text-muted"><b className="text-ink">{s.title}</b>{date && <> · completed {date}</>}</span>
        <button type="button" onClick={save} disabled={state === "busy"}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-[.92rem] font-semibold hover:border-muted disabled:opacity-60">
          {state === "busy" ? "Preparing…" : state === "error" ? "Try again" : "Download PNG"}
        </button>
      </div>
    </div>
  );
}
