"use client";

import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "@/components/account/AccountData";
import { scoreCv, type AtsSection } from "@/lib/cv/ats";
import { SECTION_LABELS } from "@/lib/cv/format";
import type { CvCheckRecord } from "@/lib/cv/repo";
import type { CvData } from "@/lib/cv/schema";
import { btnOrange, inputCls } from "./ui";

const sectionName = (s: AtsSection) => (s === "basics" ? "Contact details" : SECTION_LABELS[s]);

/**
 * Check the CV against a job description. The AI reads the job's keywords once; after that the score is worked out
 * in the browser from those keywords, so it updates live as the CV is edited.
 */
export function AtsCheckPanel({ cvId, data, flush, onAddKeyword, onGoTo }: {
  cvId: string; data: CvData; flush: () => Promise<boolean>;
  onAddKeyword: (term: string) => void; onGoTo: (s: AtsSection) => void;
}) {
  const [checks, setChecks] = useState<CvCheckRecord[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [jd, setJd] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/cv/${cvId}/check`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { checks: [] }))
      .then((j) => { if (!live) return; setChecks(j.checks ?? []); setActive(j.checks?.[0]?.id ?? null); setForm(!j.checks?.length); })
      .catch(() => { if (live) { setChecks([]); setForm(true); } });
    return () => { live = false; };
  }, [cvId]);

  const check = checks?.find((c) => c.id === active) ?? null;
  const result = useMemo(() => (check ? scoreCv(data, check.keywords) : null), [check, data]);

  const run = async () => {
    setError("");
    if (jd.trim().length < 50) { setError("Paste the whole job description (at least a few lines)."); return; }
    setBusy(true);
    try {
      if (!(await flush())) throw new Error("Fix the form first: the check reads your saved CV.");
      const r = await fetch(`/api/cv/${cvId}/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobDescription: jd, jobTitle: title || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "The check didn’t work. Please try again.");
      setChecks((list) => [j.check, ...(list ?? [])].slice(0, 10));
      setActive(j.check.id);
      setRemaining(j.remaining ?? null);
      setForm(false);
      setJd("");
      setTitle("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!checks) return <div className="h-64 animate-pulse rounded-[18px] bg-surface" aria-busy="true" />;

  return (
    <div className="grid gap-4">
      {form ? (
        <section className="grid gap-4 rounded-[18px] border border-line bg-surface p-5" aria-labelledby="atsH">
          <div className="grid gap-1">
            <h2 id="atsH" className="m-0 font-display text-[1.2rem] font-bold">Check your CV against a job</h2>
            <p className="m-0 text-[.9rem] text-muted">Paste a job ad. We’ll find the keywords applicant tracking systems look for and show what your CV is missing.</p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="atsTitle" className="text-[.85rem] font-semibold">Job title <span className="font-normal text-muted">(optional)</span></label>
            <input id="atsTitle" className={inputCls} value={title} maxLength={120} placeholder="e.g. Junior Frontend Developer at Acme" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="atsJd" className="text-[.85rem] font-semibold">Job description</label>
            <textarea id="atsJd" rows={9} maxLength={15000} className={inputCls + " h-auto py-2.5 leading-relaxed"} value={jd}
              placeholder="Paste the full job description here: responsibilities, requirements, nice-to-haves…" onChange={(e) => setJd(e.target.value)} />
          </div>
          {error && <p className="m-0 text-[.9rem] text-danger" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnOrange + " h-11"} onClick={run} disabled={busy}>{busy ? "Checking… (about 15 seconds)" : "Check my CV"}</button>
            {checks.length > 0 && <button type="button" className="h-11 rounded-xl px-4 font-semibold text-muted hover:text-ink" onClick={() => { setForm(false); setError(""); }}>Cancel</button>}
          </div>
        </section>
      ) : check && result && (
        <>
          <section className="grid gap-5 rounded-[18px] border border-line bg-surface p-5" aria-label="ATS score">
            <div className="flex flex-wrap items-center gap-5">
              <Ring score={result.score} />
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="eyebrow">ATS match</span>
                <b className="truncate font-display text-[1.15rem]">{check.jobTitle || "This job"}</b>
                <span className="text-[.85rem] text-muted">
                  {result.score >= 75 ? "Strong match. Fill any gaps below and you’re ready to apply." : result.score >= 50 ? "Good start. The items below will raise your score." : "Needs work. Start with the first suggestions below."}
                </span>
                {result.score !== check.score && <span className="font-mono text-[.75rem] text-muted">Was {check.score} when checked · updates as you edit</span>}
              </div>
            </div>
            <div className="grid gap-2">
              <Part label="Keywords" weight={60} value={result.parts.keywords} />
              <Part label="Structure" weight={25} value={result.parts.structure} />
              <Part label="Wording" weight={15} value={result.parts.wording} />
            </div>
            <ul className="m-0 grid list-none gap-1 p-0 text-[.88rem] sm:grid-cols-2">
              {result.checks.map((c) => <li key={c.id} className={c.pass ? "text-muted" : "text-ink"}><span className={c.pass ? "text-done" : "text-danger"} aria-hidden="true">{c.pass ? "✓" : "✗"}</span> {c.label}</li>)}
            </ul>
          </section>

          {result.missing.length > 0 && (
            <section className="grid gap-3 rounded-[18px] border border-line bg-surface p-5" aria-labelledby="missH">
              <div className="grid gap-0.5">
                <h3 id="missH" className="m-0 font-display text-[1.05rem] font-bold">Missing keywords <span className="font-mono text-[.8rem] font-normal text-muted">{result.missing.length}</span></h3>
                <p className="m-0 text-[.85rem] text-muted">Only add skills you really have. Even better, mention them in a job or project too.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...result.missing].sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "required" ? -1 : 1)).map((k) => (
                  <span key={k.term} className={"inline-flex min-h-9 items-center gap-1 rounded-full border pl-3 text-[.88rem] " + (k.importance === "required" ? "border-highlight/60 bg-[rgba(255,90,0,.08)]" : "border-line")}>
                    {k.term}
                    {k.importance === "required" && <span className="font-mono text-[.66rem] text-[#FF8A00] uppercase">req</span>}
                    <button type="button" className="ml-1 h-9 rounded-r-full px-3 font-semibold text-route hover:bg-sunk" onClick={() => onAddKeyword(k.term)} aria-label={`Add ${k.term} to skills`}>+ Add</button>
                  </span>
                ))}
              </div>
            </section>
          )}

          {result.matched.length > 0 && (
            <section className="grid gap-2 rounded-[18px] border border-line bg-surface p-5" aria-labelledby="matchH">
              <h3 id="matchH" className="m-0 font-display text-[1.05rem] font-bold">Found in your CV <span className="font-mono text-[.8rem] font-normal text-muted">{result.matched.length}</span></h3>
              <div className="flex flex-wrap gap-1.5">
                {result.matched.map((k) => <span key={k.term} className="rounded-full bg-done-soft px-3 py-1 text-[.85rem] text-done">✓ {k.term}</span>)}
              </div>
            </section>
          )}

          {result.suggestions.length > 0 && (
            <section className="grid gap-2 rounded-[18px] border border-line bg-surface p-5" aria-labelledby="sugH">
              <h3 id="sugH" className="m-0 font-display text-[1.05rem] font-bold">Suggestions</h3>
              <ol className="m-0 grid list-none gap-2 p-0">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="grid gap-1.5 rounded-xl bg-band p-3">
                    <span className="flex items-start gap-2 text-[.92rem]">
                      <span className={"mt-1.5 size-2 shrink-0 rounded-full " + (s.level === "high" ? "bg-highlight" : s.level === "medium" ? "bg-warm" : "bg-muted")} aria-label={`${s.level} priority`} />
                      {s.message}
                    </span>
                    <button type="button" className="justify-self-start pl-4 text-[.84rem] font-semibold text-route hover:underline" onClick={() => onGoTo(s.section)}>
                      Go to {sectionName(s.section)} →
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {!form && (
        <button type="button" className="h-11 rounded-xl border border-dashed border-line font-semibold text-muted hover:border-muted hover:text-ink" onClick={() => setForm(true)}>
          + Check against another job
        </button>
      )}
      {remaining !== null && <p className="m-0 text-center font-mono text-[.74rem] text-muted">{remaining} AI checks and rewrites left today</p>}

      {checks.length > 1 && (
        <section className="grid gap-2" aria-labelledby="pastH">
          <h3 id="pastH" className="m-0 font-mono text-[.72rem] font-medium tracking-[.08em] text-muted uppercase">Past checks</h3>
          <ul className="m-0 grid list-none gap-1 p-0">
            {checks.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => { setActive(c.id); setForm(false); }} aria-current={c.id === active}
                  className={"flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left " + (c.id === active ? "bg-sunk" : "hover:bg-surface")}>
                  <span className="truncate">{c.jobTitle || "Untitled job"} <span className="text-[.82rem] text-muted">· {timeAgo(new Date(c.createdAt).getTime())}</span></span>
                  <b className={"font-mono " + (c.score >= 75 ? "text-done" : "text-[#FF8A00]")}>{c.score}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Ring({ score }: { score: number }) {
  const r = 42, c = 2 * Math.PI * r, good = score >= 75;
  return (
    <div className="relative size-28 shrink-0" role="img" aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--sunk)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={good ? "var(--done)" : "var(--highlight)"} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - score / 100)).toFixed(1)} style={{ transition: "stroke-dashoffset .4s ease" }} />
      </svg>
      <span className="absolute inset-0 grid place-content-center text-center">
        <b className="font-display text-[2rem] leading-none">{score}</b>
        <span className="font-mono text-[.68rem] text-muted">/ 100</span>
      </span>
    </div>
  );
}

function Part({ label, weight, value }: { label: string; weight: number; value: number }) {
  const pts = Math.round(value * weight);
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_56px] items-center gap-3 text-[.88rem]">
      <span>{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-sunk"><i className={"block h-full rounded-full " + (value >= 0.75 ? "bg-done" : "bg-route")} style={{ width: `${Math.max(2, value * 100)}%` }} /></span>
      <span className="text-right font-mono text-[.8rem] text-muted">{pts}/{weight}</span>
    </div>
  );
}
