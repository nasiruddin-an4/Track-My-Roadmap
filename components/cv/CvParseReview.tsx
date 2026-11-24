"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { btnGhost } from "@/components/account/ui";
import { contactParts, hasContent, SECTION_LABELS } from "@/lib/cv/format";
import type { CvData, SectionKey } from "@/lib/cv/schema";
import { CvPreview } from "./CvPreview";
import type { ParseResult } from "./CvUploadDropzone";
import { btnOrange, inputCls } from "./ui";

/** What a section holds, in a few words, so people can check the import at a glance. */
function describe(d: CvData, k: SectionKey): string {
  const names = (a: string[]) => a.filter(Boolean).slice(0, 3).join(" · ") + (a.filter(Boolean).length > 3 ? ` · +${a.filter(Boolean).length - 3} more` : "");
  switch (k) {
    case "summary": return (d.basics.summary ?? "").slice(0, 110) + ((d.basics.summary ?? "").length > 110 ? "…" : "");
    case "skills": return names(d.skills.flatMap((s) => s.keywords));
    case "work": return names(d.work.map((w) => [w.position, w.name].filter(Boolean).join(" at ")));
    case "projects": return names(d.projects.map((p) => p.name));
    case "education": return names(d.education.map((e) => e.institution));
    case "certificates": return names(d.certificates.map((c) => c.name));
    case "languages": return names((d.languages ?? []).map((l) => l.language));
  }
}

const EMPTY: { [K in SectionKey]: (d: CvData) => CvData } = {
  summary: (d) => ({ ...d, basics: { ...d.basics, summary: "" } }),
  skills: (d) => ({ ...d, skills: [] }),
  work: (d) => ({ ...d, work: [] }),
  projects: (d) => ({ ...d, projects: [] }),
  education: (d) => ({ ...d, education: [] }),
  certificates: (d) => ({ ...d, certificates: [] }),
  languages: (d) => ({ ...d, languages: [] }),
};

/** After an import: check what was found, untick anything wrong, and save it as a new CV. */
export function CvParseReview({ result, onCancel }: { result: ParseResult; onCancel: () => void }) {
  const router = useRouter();
  const found = result.data.sectionOrder.filter((k) => hasContent(result.data, k));
  const missing = result.data.sectionOrder.filter((k) => !hasContent(result.data, k));
  const [keep, setKeep] = useState<Set<SectionKey>>(() => new Set(found));
  const [title, setTitle] = useState(() => (result.data.basics.label || result.data.basics.name ? `${result.data.basics.label || result.data.basics.name} CV`.slice(0, 80) : "Imported CV"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const data = useMemo(() => found.filter((k) => !keep.has(k)).reduce((d, k) => EMPTY[k](d), result.data), [found, keep, result.data]);
  const b = result.data.basics;
  const warnings = [
    !b.name && "We couldn’t find your name.",
    !b.email && "We couldn’t find an email address. Recruiters need one, so add it in the next step.",
    !found.includes("work") && !found.includes("projects") && "No experience or projects were found. Add at least one so the CV shows what you’ve done.",
  ].filter(Boolean) as string[];

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/cv", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Imported CV", data, upload: result.upload }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn’t save the CV.");
      router.push(`/cv/${j.cv.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <section className="grid content-start gap-5" aria-labelledby="revH">
        <div className="grid gap-1">
          <span className="eyebrow">Step 2 of 2 · Check the import</span>
          <h2 id="revH" className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">Here’s what we found</h2>
          <p className="m-0 text-muted">From <b className="text-ink">{result.fileName}</b>. Untick anything that came out wrong; you can edit every detail after saving.</p>
        </div>

        <div className="grid gap-1.5 rounded-[18px] border border-line bg-surface p-5">
          <span className="text-[.85rem] font-semibold">Contact details</span>
          <p className="m-0"><b>{b.name || "No name found"}</b>{b.label && <span className="text-muted"> · {b.label}</span>}</p>
          <p className="m-0 text-[.9rem] break-words text-muted">{contactParts(b).join(" · ") || "No contact details found"}</p>
        </div>

        <ul className="m-0 grid list-none gap-2 p-0">
          {found.map((k) => (
            <li key={k}>
              <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-line bg-surface p-4 transition-colors has-[:checked]:border-done/50">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--done)]" checked={keep.has(k)}
                  onChange={(e) => setKeep((s) => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
                <span className="grid min-w-0 gap-0.5">
                  <b>{SECTION_LABELS[k]}</b>
                  <span className="text-[.88rem] break-words text-muted">{describe(result.data, k)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {missing.length > 0 && <p className="m-0 text-[.88rem] text-muted">Not in this file: {missing.map((k) => SECTION_LABELS[k]).join(", ")}. You can add them later.</p>}

        {warnings.length > 0 && (
          <ul className="m-0 grid list-none gap-1 rounded-[14px] border border-warm/40 bg-[rgba(242,164,98,.08)] p-4 text-[.9rem]">
            {warnings.map((w) => <li key={w}>⚠ {w}</li>)}
          </ul>
        )}

        <div className="grid gap-1.5">
          <label htmlFor="revTitle" className="text-[.85rem] font-semibold">Name this CV</label>
          <input id="revTitle" className={inputCls} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          <span className="text-[.8rem] text-muted">Only you see this, e.g. “Frontend CV”.</span>
        </div>

        {error && <p className="m-0 text-danger" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnOrange + " h-12 flex-1 px-6 text-[1rem] sm:flex-none"} onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save and edit →"}
          </button>
          <button type="button" className={btnGhost + " h-12"} onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </section>

      <div className="min-w-0 lg:sticky lg:top-[calc(var(--top)+24px)] lg:self-start">
        <CvPreview data={data} pageSize="a4" />
      </div>
    </div>
  );
}
