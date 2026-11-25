"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { timeAgo } from "@/components/account/AccountData";
import { btnGhost } from "@/components/account/ui";
import { Arrow } from "@/components/icons";
import { useToast } from "@/components/toast";
import type { CvSummary } from "@/lib/cv/repo";
import { CvParseReview } from "./CvParseReview";
import { CvUploadDropzone, type ParseResult } from "./CvUploadDropzone";
import { btnOrange } from "./ui";

/** /cv: the person's CVs, and the way to start a new one. */
/** `ai`: CV import is switched on (it needs the AI key). Without it, people start from scratch. */
export function CvList({ ai }: { ai: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [cvs, setCvs] = useState<CvSummary[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [review, setReview] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/cv", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.cvs as CvSummary[]; })
      .then((list) => { if (live) setCvs(list); })
      .catch((e: Error) => { if (live) setError(e.message || "Couldn’t load your CVs."); });
    return () => { live = false; };
  }, []);

  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(null), 4000); return () => clearTimeout(t); }, [armed]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/cv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: cvs?.length ? `CV ${cvs.length + 1}` : "My CV" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      router.push(`/cv/${j.cv.id}`);
    } catch (e) {
      toast((e as Error).message || "Couldn’t create the CV.");
      setBusy(false);
    }
  };

  const duplicate = async (cv: CvSummary) => {
    const r = await fetch(`/api/cv/${cv.id}/duplicate`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || "Couldn’t copy the CV."); return; }
    const c = j.cv;
    setCvs((list) => [{ id: c.id, title: c.title, isPrimary: false, isShared: false, pageSize: c.pageSize, createdAt: c.createdAt, updatedAt: c.updatedAt, name: cv.name, label: cv.label }, ...(list ?? [])]);
    toast(`Made “${c.title}”`);
  };

  const makePrimary = async (cv: CvSummary) => {
    const primary = !cv.isPrimary;
    const r = await fetch(`/api/cv/${cv.id}/primary`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primary }) });
    if (!r.ok) { toast("Couldn’t change your primary CV."); return; }
    setCvs((list) => (list ?? []).map((x) => ({ ...x, isPrimary: x.id === cv.id ? primary : primary ? false : x.isPrimary })));
    toast(primary ? `“${cv.title}” is now your primary CV` : "No primary CV set");
  };

  const remove = async (cv: CvSummary) => {
    if (armed !== cv.id) { setArmed(cv.id); return; }
    setArmed(null);
    const r = await fetch(`/api/cv/${cv.id}`, { method: "DELETE" });
    if (!r.ok) { toast("Couldn’t delete the CV. Please try again."); return; }
    setCvs((list) => (list ?? []).filter((x) => x.id !== cv.id));
    toast(`Deleted ${cv.title}`);
  };

  if (review) {
    return (
      <div className="wrap py-8 sm:py-12">
        <button type="button" onClick={() => setReview(null)} className="mb-4 text-[.9rem] font-semibold text-muted hover:text-ink">← Back to your CVs</button>
        <CvParseReview result={review} onCancel={() => setReview(null)} />
      </div>
    );
  }

  return (
    <div className="wrap py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Link href="/account/profile" className="text-[.9rem] font-semibold text-muted hover:text-ink">← Profile</Link>
          <h1 className="m-0 font-display text-[clamp(2rem,4.6vw,3rem)] leading-[1.05] font-bold tracking-[-.03em]">
            CV <span className="text-highlight">Builder</span>
          </h1>
          <p className="m-0 max-w-[60ch] text-muted">Build a clean, ATS-friendly CV that recruiters’ software can read, and download it as a PDF.</p>
        </div>
        {cvs && cvs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ai && <button type="button" className={btnGhost} aria-expanded={importing} onClick={() => setImporting((v) => !v)}>↑ Import CV</button>}
            <button type="button" className={btnOrange} onClick={create} disabled={busy}>{busy ? "Creating…" : "+ New CV"}</button>
          </div>
        )}
      </header>

      {error ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-muted" role="alert">{error}</p>
      ) : !cvs ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-[20px] bg-surface" />)}
        </div>
      ) : !cvs.length ? (
        <div className={"grid gap-4 " + (ai ? "md:grid-cols-2" : "max-w-[640px]")}>
          {ai && <section className="grid content-start gap-4 rounded-[22px] border border-line bg-surface p-6 sm:p-8" aria-labelledby="upH">
            <div className="grid gap-1">
              <span className="eyebrow">Have a CV already?</span>
              <h2 id="upH" className="m-0 font-display text-[1.45rem] font-bold tracking-[-.02em]">Upload your CV</h2>
              <p className="m-0 text-muted">We’ll read it into sections for you to check, then turn it into a clean, ATS-friendly layout.</p>
            </div>
            <CvUploadDropzone onParsed={setReview} />
          </section>}
          <section className="grid content-start gap-4 rounded-[22px] border border-line bg-surface p-6 sm:p-8" aria-labelledby="newH">
            <div className="grid gap-1">
              <span className="eyebrow">{ai ? "Starting fresh?" : "Start here"}</span>
              <h2 id="newH" className="m-0 font-display text-[1.45rem] font-bold tracking-[-.02em]">Start from scratch</h2>
              <p className="m-0 text-muted">Your name and email are filled in, and we’ll suggest skills and certificates from your roadmaps.</p>
            </div>
            <ul className="m-0 grid list-none gap-2 p-0 text-[.95rem] text-muted">
              <li>✓ One clean column that applicant tracking systems read correctly</li>
              <li>✓ Live preview while you type, saved automatically</li>
              <li>✓ Download a PDF with real, selectable text</li>
            </ul>
            <button type="button" className={btnOrange + " h-12 px-6 text-[1rem]"} onClick={create} disabled={busy}>
              {busy ? "Creating…" : <>Start from scratch <Arrow size={15} /></>}
            </button>
          </section>
        </div>
      ) : (
        <>
        {ai && importing && (
          <section className="mb-6 grid gap-3 rounded-[22px] border border-line bg-surface p-5 sm:p-6" aria-label="Import a CV">
            <p className="m-0 text-muted">Upload a CV to make a new one from it. Your other CVs aren’t changed.</p>
            <CvUploadDropzone onParsed={(r) => { setImporting(false); setReview(r); }} />
          </section>
        )}
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.map((cv) => (
            <li key={cv.id} className="grid content-between gap-4 rounded-[20px] border border-line bg-surface p-5">
              <Link href={`/cv/${cv.id}`} className="group grid gap-1">
                <span className="flex items-center gap-2">
                  <b className="truncate font-display text-[1.15rem] group-hover:text-route">{cv.title}</b>
                  {cv.isPrimary && <span className="rounded-full bg-done-soft px-2 py-0.5 font-mono text-[.7rem] text-done">PRIMARY</span>}
                  {cv.isShared && <span className="rounded-full bg-route-soft px-2 py-0.5 font-mono text-[.7rem] text-route" title="Anyone with the link can see it">SHARED</span>}
                </span>
                <span className="truncate text-[.92rem]">{cv.name || "No name yet"}{cv.label && <span className="text-muted"> · {cv.label}</span>}</span>
                <span className="font-mono text-[.76rem] text-muted">{cv.pageSize.toUpperCase()} · edited {timeAgo(new Date(cv.updatedAt).getTime())}</span>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Link href={`/cv/${cv.id}`} className={btnGhost + " flex-1"}>Edit</Link>
                <a href={`/api/cv/${cv.id}/pdf`} className={btnGhost + " flex-1"}>PDF</a>
                <button type="button" onClick={() => remove(cv)}
                  className={btnGhost + (armed === cv.id ? " border-danger text-danger" : " text-muted")}
                  aria-label={armed === cv.id ? `Confirm deleting ${cv.title}` : `Delete ${cv.title}`}>
                  {armed === cv.id ? "Confirm" : "Delete"}
                </button>
              </div>
              <div className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[.84rem] font-semibold">
                <a href={`/api/cv/${cv.id}/docx`} className="text-muted hover:text-ink">Word file</a>
                <button type="button" className="text-muted hover:text-ink" onClick={() => duplicate(cv)}>Duplicate</button>
                <button type="button" className="text-muted hover:text-ink" onClick={() => makePrimary(cv)}>{cv.isPrimary ? "Unset primary" : "Make primary"}</button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
