"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import type { AtsSection } from "@/lib/cv/ats";
import { SECTION_LABELS } from "@/lib/cv/format";
import { cvDataSchema, type CvData, type PageSize, type SectionKey } from "@/lib/cv/schema";
import { BulletAssist, SummaryAssist } from "./AiAssist";
import { AtsCheckPanel } from "./AtsCheckPanel";
import { CvPreview } from "./CvPreview";
import { ExportMenu } from "./ExportMenu";
import { RoadmapAutofillPanel } from "./RoadmapAutofillPanel";
import { BulletsField, iconBtn, inputCls, MonthField, RowTools, TextArea, TextField } from "./ui";

type Cv = { title: string; pageSize: PageSize; data: CvData };
type SaveState = "saved" | "pending" | "saving" | "error" | "invalid";

/** /cv/:id: section forms on the left, the live page on the right (tabs on phones). Saves itself. */
/** `ai`: the ATS check and AI writing help are switched on (they need the AI key); hidden otherwise. */
export function CvEditor({ id, ai }: { id: string; ai: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [cv, setCv] = useState<Cv | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  // phones show one pane at a time; wide screens show the form and, beside it, the preview or the ATS check
  const [tab, setTab] = useState<"edit" | "preview" | "check">("edit");
  const [side, setSide] = useState<"preview" | "check">("preview");
  // primary and sharing are changed by their own requests, not by autosave
  const [meta, setMeta] = useState<{ isPrimary: boolean; shareToken: string | null }>({ isPrimary: false, shareToken: null });

  const latest = useRef<Cv | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));

  useEffect(() => {
    let live = true;
    fetch(`/api/cv/${id}`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.cv; })
      .then((c) => {
        if (!live) return;
        const v = { title: c.title, pageSize: c.pageSize, data: c.data };
        latest.current = v;
        setCv(v);
        setMeta({ isPrimary: !!c.isPrimary, shareToken: c.shareToken ?? null });
      })
      .catch((e: Error) => { if (live) setLoadError(e.message || "Couldn’t open this CV."); });
    return () => { live = false; };
  }, [id]);

  /** Save the latest copy now (after any save already running). Resolves true once it's saved. */
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!dirty.current) return chain.current;
    dirty.current = false;
    chain.current = chain.current.then(async () => {
      const c = latest.current;
      if (!c) return false;
      const check = cvDataSchema.safeParse(c.data);
      if (!check.success) { setSave("invalid"); setSaveError(check.error.issues[0]?.message ?? ""); return false; }
      setSave("saving");
      try {
        const r = await fetch(`/api/cv/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: c.title.trim() || "My CV", pageSize: c.pageSize, data: c.data }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Couldn’t save.");
        setSave(dirty.current ? "pending" : "saved");
        setSaveError("");
        return true;
      } catch (e) {
        dirty.current = true; // try again with the next change, or on the next export
        setSave("error");
        setSaveError((e as Error).message);
        return false;
      }
    });
    return chain.current;
  }, [id]);

  const change = useCallback((fn: (c: Cv) => Cv) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next;
    setCv(next);
    dirty.current = true;
    setSave("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 1000);
  }, [flush]);
  const setData = useCallback((fn: (d: CvData) => CvData) => change((c) => ({ ...c, data: fn(c.data) })), [change]);

  // warn before leaving with changes not yet saved, and save when the tab is hidden
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { void flush(); e.preventDefault(); } };
    const hide = () => { if (document.visibilityState === "hidden") void flush(); };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("visibilitychange", hide); };
  }, [flush]);

  const issues = useMemo(() => {
    if (!cv) return {} as Record<string, string>;
    const r = cvDataSchema.safeParse(cv.data);
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
  }, [cv]);

  const remove = async () => {
    const r = await fetch(`/api/cv/${id}`, { method: "DELETE" });
    if (!r.ok) { toast("Couldn’t delete the CV. Please try again."); return; }
    dirty.current = false;
    toast("CV deleted");
    router.push("/cv");
  };

  const call = async (url: string, method: string, body?: object) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "That didn’t work. Please try again.");
    return j;
  };
  const setPrimary = async (primary: boolean) => {
    try {
      await call(`/api/cv/${id}/primary`, "POST", { primary });
      setMeta((m) => ({ ...m, isPrimary: primary }));
      toast(primary ? "This is now your primary CV" : "No longer your primary CV");
    } catch (e) { toast((e as Error).message); }
  };
  const setShare = async (on: boolean) => {
    try {
      const j = on ? await call(`/api/cv/${id}/share`, "POST") : await call(`/api/cv/${id}/share`, "DELETE");
      setMeta((m) => ({ ...m, shareToken: on ? j.token : null }));
      toast(on ? "Share link ready" : "Share link turned off. The old link no longer works.");
    } catch (e) { toast((e as Error).message); }
  };
  const duplicate = async () => {
    try {
      if (!(await flush())) throw new Error("Fix the form first, then make the copy.");
      const j = await call(`/api/cv/${id}/duplicate`, "POST");
      toast("Copy made. You’re now editing the copy.");
      router.push(`/cv/${j.cv.id}`);
    } catch (e) { toast((e as Error).message); }
  };

  /** A missing keyword from the ATS check, added to an "Additional skills" group. */
  const addKeyword = (term: string) => {
    setData((x) => {
      if (x.skills.some((g) => g.keywords.some((k) => k.trim().toLowerCase() === term.toLowerCase()))) return x;
      const at = x.skills.findIndex((g) => g.name === "Additional skills");
      if (at >= 0) return { ...x, skills: x.skills.map((g, i) => (i === at ? { ...g, keywords: [...g.keywords, term].slice(0, 40) } : g)) };
      return { ...x, skills: [...x.skills, { name: "Additional skills", keywords: [term], source: "user" as const }].slice(0, 20) };
    });
    toast(`Added ${term} to Skills`);
  };

  /** Open a section of the form and bring it into view (from an ATS suggestion). */
  const goTo = (section: AtsSection) => {
    setTab("edit");
    setTimeout(() => {
      const el = document.getElementById(`sec-${section}`) as HTMLDetailsElement | null;
      if (!el) return;
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  if (loadError) {
    return (
      <div className="wrap grid place-items-center py-24">
        <div className="grid max-w-[440px] gap-3 rounded-[22px] border border-line bg-surface p-8 text-center">
          <h1 className="m-0 font-display text-[1.5rem] font-bold">Can’t open this CV</h1>
          <p className="m-0 text-muted">{loadError}</p>
          <Link href="/cv" className="font-semibold text-route hover:underline">← Back to your CVs</Link>
        </div>
      </div>
    );
  }
  if (!cv) return <div className="wrap py-24 text-center text-muted" aria-busy="true">Opening your CV…</div>;

  const d = cv.data;
  const status = { saved: "✓ Saved", pending: "Unsaved changes", saving: "Saving…", error: "Not saved", invalid: "Not saved" }[save];
  const bn = d.locale === "bn";
  // the ATS check reads English keywords and wording, so it's offered for English CVs only
  const ats = ai && !bn;

  return (
    <div className="wrap pb-16">
      {/* toolbar */}
      <div className="sticky top-[var(--top)] z-20 -mx-4 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Link href="/cv" className={iconBtn + " size-10"} aria-label="All CVs">←</Link>
        <label className="sr-only" htmlFor="cvTitle">CV name</label>
        <input id="cvTitle" value={cv.title} maxLength={80} onChange={(e) => change((c) => ({ ...c, title: e.target.value }))}
          className="h-10 min-w-0 flex-1 basis-40 rounded-lg border border-transparent bg-transparent px-2 font-display text-[1.25rem] font-bold hover:border-line focus:border-route focus:outline-none" />
        <span className={"font-mono text-[.78rem] " + (save === "error" || save === "invalid" ? "text-danger" : save === "saved" ? "text-done" : "text-muted")}
          role="status" title={saveError || undefined}>{status}</span>
        <ExportMenu id={id} pageSize={cv.pageSize} flush={flush} placeholders={/\[X[^\]]*\]/.test(JSON.stringify(d))}
          onPageSize={(p) => change((c) => ({ ...c, pageSize: p }))} onDelete={remove}
          isPrimary={meta.isPrimary} onPrimary={setPrimary} shareToken={meta.shareToken} onShare={setShare} onDuplicate={duplicate} />
        {(save === "error" || save === "invalid") && saveError && (
          <p className="m-0 w-full text-[.85rem] text-danger" role="alert">
            {save === "invalid" ? `Check the form: ${saveError}.` : `${saveError} We’ll try again when you make another change.`}
          </p>
        )}
      </div>

      {/* phones: edit, preview or (with AI) ATS check */}
      <div className={"mb-4 grid gap-1 rounded-xl border border-line bg-surface p-1 lg:hidden " + (ats ? "grid-cols-3" : "grid-cols-2")} role="tablist" aria-label="View">
        {(ats ? (["edit", "preview", "check"] as const) : (["edit", "preview"] as const)).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); if (t !== "edit") setSide(t); }}
            className={"h-11 rounded-lg font-semibold " + (tab === t ? "bg-sunk text-ink" : "text-muted")}>
            {t === "edit" ? "Edit" : t === "preview" ? "Preview" : "ATS check"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        <div className={(tab === "edit" ? "grid" : "hidden") + " content-start gap-4 lg:grid"}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line bg-surface px-5 py-3.5">
            <span className="grid min-w-0 flex-1 basis-56 gap-0.5">
              <b className="font-display">CV language</b>
              <span className="text-[.84rem] text-muted">
                {bn
                  ? "Section names, months and digits are in Bengali; type your details in Bengali. The PDF prints perfectly, but text copied out of it can come out jumbled, so if a job site reads your CV automatically, upload the Word file. (The ATS check is for English CVs.)"
                  : "Applying for a local or government job? Make this CV in Bengali."}
              </span>
            </span>
            <div role="radiogroup" aria-label="CV language" className="flex gap-1 rounded-xl bg-bg p-1 ring-1 ring-line">
              {(["en", "bn"] as const).map((lc) => (
                <button key={lc} type="button" role="radio" aria-checked={(d.locale ?? "en") === lc}
                  onClick={() => setData((x) => ({ ...x, locale: lc }))}
                  className={"h-9 rounded-lg px-3.5 text-[.92rem] font-semibold transition-colors "
                    + ((d.locale ?? "en") === lc ? "bg-route text-route-ink" : "text-muted hover:text-ink")}>
                  {lc === "en" ? "English" : <span lang="bn">বাংলা</span>}
                </button>
              ))}
            </div>
          </div>
          <RoadmapAutofillPanel data={d} onApply={setData} />
          <Card id="sec-basics" title="Contact details" open>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Full name" value={d.basics.name} autoComplete="name" error={issues["basics.name"]}
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, name: v } }))} />
              <TextField label="Headline" value={d.basics.label} placeholder="e.g. Frontend Developer" error={issues["basics.label"]}
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, label: v } }))} />
              <TextField label="Email" type="email" value={d.basics.email} autoComplete="email" error={issues["basics.email"]}
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, email: v } }))} />
              <TextField label="Phone" type="tel" value={d.basics.phone} autoComplete="tel" placeholder="+880 1XXX-XXXXXX"
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, phone: v } }))} />
              <TextField label="City" value={d.basics.location?.city} placeholder="e.g. Dhaka"
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, location: { ...x.basics.location, city: v } } }))} />
              <TextField label="Country" value={d.basics.location?.country} placeholder="e.g. Bangladesh"
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, location: { ...x.basics.location, country: v } } }))} />
              <TextField label="Website or portfolio" value={d.basics.url} placeholder="yoursite.dev" className="sm:col-span-2"
                onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, url: v } }))} />
            </div>
            <Profiles list={d.basics.profiles ?? []} onChange={(p) => setData((x) => ({ ...x, basics: { ...x.basics, profiles: p } }))} />
          </Card>

          <Card id="sec-summary" title="Summary" open>
            <TextArea label="Professional summary" rows={4} value={d.basics.summary}
              placeholder="2–3 lines: who you are, what you build, and what you’re looking for."
              hint="Keep it short. Mention your main skills and the kind of role you want."
              onChange={(v) => setData((x) => ({ ...x, basics: { ...x.basics, summary: v } }))} />
            {ai && <SummaryAssist cvId={id} current={d.basics.summary ?? ""} flush={flush}
              onAccept={(t) => setData((x) => ({ ...x, basics: { ...x.basics, summary: t } }))} />}
          </Card>

          <Card id="sec-skills" title="Skills" count={d.skills.length}>
            <List items={d.skills} what="skill group" addLabel="+ Add skill group"
              blank={{ name: "", keywords: [], source: "user" as const }} onChange={(v) => setData((x) => ({ ...x, skills: v }))}
              heading={(s) => s.name || "Skill group"} badge={(s) => (s.source === "roadmap" ? "From your roadmaps" : undefined)}
              render={(s, patch) => (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]">
                  <TextField label="Group" value={s.name} placeholder="e.g. Languages" onChange={(v) => patch({ name: v })} />
                  <TextField label="Skills (comma separated)" value={s.keywords.join(", ")} maxLength={1200}
                    placeholder="JavaScript, TypeScript, Python" onChange={(v) => patch({ keywords: v.split(/,\s*/).slice(0, 40) })} />
                </div>
              )} />
          </Card>

          <Card id="sec-work" title={SECTION_LABELS.work} count={d.work.length}>
            <List items={d.work} what="job" addLabel="+ Add job"
              blank={{ name: "", position: "", location: "", startDate: "", endDate: "", highlights: [] }}
              onChange={(v) => setData((x) => ({ ...x, work: v }))}
              heading={(w) => [w.position, w.name].filter(Boolean).join(" at ") || "New job"}
              render={(w, patch, i) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Job title" value={w.position} placeholder="e.g. Junior Developer" onChange={(v) => patch({ position: v })} />
                  <TextField label="Company" value={w.name} onChange={(v) => patch({ name: v })} />
                  <TextField label="Location" value={w.location} placeholder="e.g. Dhaka or Remote" className="sm:col-span-2" onChange={(v) => patch({ location: v })} />
                  <MonthField label="Start" value={w.startDate} onChange={(v) => patch({ startDate: v })} />
                  <div className="grid gap-2">
                    <MonthField label="End" value={w.endDate} disabled={!w.endDate} onChange={(v) => patch({ endDate: v })} />
                    <label className="flex items-center gap-2 text-[.88rem] text-muted">
                      <input type="checkbox" className="size-4 accent-[var(--highlight)]" checked={!w.endDate}
                        onChange={(e) => patch({ endDate: e.target.checked ? "" : thisMonth() })} />
                      I work here now
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <BulletsField label="What you did" value={w.highlights} placeholder={"Built …\nImproved …"} onChange={(v) => patch({ highlights: v })} />
                    {ai && <BulletAssist cvId={id} bullets={w.highlights} position={w.position} company={w.name}
                      onReplace={(j, t) => patch({ highlights: w.highlights.map((h, k) => (k === j ? t : h)) })} />}
                  </div>
                  {issues[`work.${i}.startDate`] && <p className="m-0 text-[.8rem] text-danger sm:col-span-2">{issues[`work.${i}.startDate`]}</p>}
                </div>
              )} />
          </Card>

          <Card id="sec-projects" title={SECTION_LABELS.projects} count={d.projects.length}>
            <List items={d.projects} what="project" addLabel="+ Add project"
              blank={{ name: "", description: "", highlights: [], url: "" }} onChange={(v) => setData((x) => ({ ...x, projects: v }))}
              heading={(p) => p.name || "New project"}
              render={(p, patch) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Project name" value={p.name} onChange={(v) => patch({ name: v })} />
                  <TextField label="Link" value={p.url} placeholder="github.com/you/project" onChange={(v) => patch({ url: v })} />
                  <TextArea label="One-line description" rows={2} maxLength={600} value={p.description} className="sm:col-span-2"
                    placeholder="What it is and what you built it with." onChange={(v) => patch({ description: v })} />
                  <div className="sm:col-span-2">
                    <BulletsField label="Highlights" value={p.highlights} onChange={(v) => patch({ highlights: v })} />
                    {ai && <BulletAssist cvId={id} bullets={p.highlights ?? []} position={p.name}
                      onReplace={(j, t) => patch({ highlights: (p.highlights ?? []).map((h, k) => (k === j ? t : h)) })} />}
                  </div>
                </div>
              )} />
          </Card>

          <Card id="sec-education" title={SECTION_LABELS.education} count={d.education.length}>
            <List items={d.education} what="school" addLabel="+ Add education"
              blank={{ institution: "", area: "", studyType: "", startDate: "", endDate: "", score: "" }}
              onChange={(v) => setData((x) => ({ ...x, education: v }))}
              heading={(e) => e.institution || "New education"}
              render={(e, patch) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="School or university" value={e.institution} className="sm:col-span-2" onChange={(v) => patch({ institution: v })} />
                  <TextField label="Degree" value={e.studyType} placeholder="e.g. BSc" onChange={(v) => patch({ studyType: v })} />
                  <TextField label="Subject" value={e.area} placeholder="e.g. Computer Science" onChange={(v) => patch({ area: v })} />
                  <MonthField label="Start" value={e.startDate} onChange={(v) => patch({ startDate: v })} />
                  <MonthField label="End (or expected)" value={e.endDate} onChange={(v) => patch({ endDate: v })} />
                  <TextField label="Result" value={e.score} placeholder="e.g. CGPA 3.6/4.0" maxLength={40} onChange={(v) => patch({ score: v })} />
                </div>
              )} />
          </Card>

          <Card id="sec-certificates" title={SECTION_LABELS.certificates} count={d.certificates.length}>
            <List items={d.certificates} what="certificate" addLabel="+ Add certificate"
              blank={{ name: "", issuer: "", date: "", url: "", source: "user" as const }}
              onChange={(v) => setData((x) => ({ ...x, certificates: v }))}
              heading={(c) => c.name || "New certificate"} badge={(c) => (c.source === "trackmyroadmap" ? "From your roadmaps" : undefined)}
              render={(c, patch) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Certificate" value={c.name} onChange={(v) => patch({ name: v })} />
                  <TextField label="Issued by" value={c.issuer} onChange={(v) => patch({ issuer: v })} />
                  <MonthField label="Date" value={c.date} onChange={(v) => patch({ date: v })} />
                  <TextField label="Link" value={c.url} placeholder="Verification link" onChange={(v) => patch({ url: v })} />
                </div>
              )} />
          </Card>

          <Card id="sec-languages" title={SECTION_LABELS.languages} count={d.languages?.length ?? 0}>
            <List items={d.languages ?? []} what="language" addLabel="+ Add language"
              blank={{ language: "", fluency: "" }} onChange={(v) => setData((x) => ({ ...x, languages: v }))}
              heading={(l) => l.language || "New language"}
              render={(l, patch) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Language" value={l.language} placeholder="e.g. English" onChange={(v) => patch({ language: v })} />
                  <TextField label="Level" value={l.fluency} placeholder="e.g. Fluent, Native" onChange={(v) => patch({ fluency: v })} />
                </div>
              )} />
          </Card>

          <Card title="Section order">
            <Order order={d.sectionOrder} onChange={(o) => setData((x) => ({ ...x, sectionOrder: o }))} />
          </Card>
        </div>

        <div className={(tab !== "edit" ? "block" : "hidden") + " min-w-0 lg:sticky lg:top-[calc(var(--top)+88px)] lg:block lg:max-h-[calc(100vh-var(--top)-104px)] lg:self-start lg:overflow-y-auto"}>
          {ats && <div className="mb-3 hidden grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 lg:grid" role="tablist" aria-label="Side panel">
            {(["preview", "check"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={side === t} onClick={() => setSide(t)}
                className={"h-10 rounded-lg font-semibold " + (side === t ? "bg-sunk text-ink" : "text-muted")}>
                {t === "preview" ? "Preview" : "ATS check"}
              </button>
            ))}
          </div>}
          {!ats || side === "preview"
            ? <CvPreview data={d} pageSize={cv.pageSize} />
            : <AtsCheckPanel cvId={id} data={d} flush={flush} onAddKeyword={addKeyword} onGoTo={goTo} />}
        </div>
      </div>
    </div>
  );
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

function Card({ id, title, count, open, children }: { id?: string; title: string; count?: number; open?: boolean; children: React.ReactNode }) {
  return (
    <details id={id} open={open} className="group scroll-mt-[calc(var(--top)+90px)] rounded-[18px] border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-display text-[1.08rem] font-bold [&::-webkit-details-marker]:hidden">
        <span>{title}{count ? <span className="ml-2 font-mono text-[.78rem] font-medium text-muted">{count}</span> : null}</span>
        <span className="text-muted transition group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>
      <div className="grid gap-4 border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}

/** Entries of one section: each with its own fields, reorderable and removable. */
function List<T>({ items, onChange, blank, render, heading, badge, what, addLabel }: {
  items: T[]; onChange: (v: T[]) => void; blank: T; what: string; addLabel: string; badge?: (item: T) => string | undefined;
  heading: (item: T) => string; render: (item: T, patch: (p: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  return (
    <div className="grid gap-3">
      {items.map((item, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-line bg-band p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <b className="truncate text-[.95rem]">{heading(item)}</b>
              {badge?.(item) && <span className="shrink-0 rounded-full bg-route-soft px-2 py-0.5 text-[.72rem] font-semibold text-route">{badge(item)}</span>}
            </span>
            <RowTools index={i} count={items.length} what={what} onMove={(dir) => move(i, dir)} onRemove={() => onChange(items.filter((_, k) => k !== i))} />
          </div>
          {render(item, (p) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x))), i)}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...blank }])}
        className="h-11 rounded-xl border border-dashed border-line font-semibold text-muted transition hover:border-muted hover:text-ink">
        {addLabel}
      </button>
    </div>
  );
}

const NETWORKS = ["LinkedIn", "GitHub"];

function Profiles({ list, onChange }: { list: { network: string; url: string }[]; onChange: (v: { network: string; url: string }[]) => void }) {
  const missing = NETWORKS.filter((n) => !list.some((p) => p.network.toLowerCase() === n.toLowerCase()));
  return (
    <div className="grid gap-2">
      <span className="text-[.85rem] font-semibold">Profiles</span>
      {list.map((p, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label="Site" className={inputCls.replace("w-full ", "") + " w-28 flex-none sm:w-32"} value={p.network} maxLength={40} placeholder="Site"
            onChange={(e) => onChange(list.map((x, k) => (k === i ? { ...x, network: e.target.value } : x)))} />
          <input aria-label={`${p.network || "Profile"} link`} className={inputCls + " flex-1"} value={p.url} maxLength={300} placeholder="linkedin.com/in/you"
            onChange={(e) => onChange(list.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
          <button type="button" className={iconBtn + " size-11 hover:text-danger"} aria-label={`Remove ${p.network || "profile"}`}
            onClick={() => onChange(list.filter((_, k) => k !== i))}>✕</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {missing.map((n) => (
          <button key={n} type="button" className="h-9 rounded-full border border-line px-3 text-[.86rem] font-semibold text-muted hover:border-muted hover:text-ink"
            onClick={() => onChange([...list, { network: n, url: "" }])}>+ {n}</button>
        ))}
        {list.length < 8 && (
          <button type="button" className="h-9 rounded-full border border-line px-3 text-[.86rem] font-semibold text-muted hover:border-muted hover:text-ink"
            onClick={() => onChange([...list, { network: "", url: "" }])}>+ Other</button>
        )}
      </div>
    </div>
  );
}

function Order({ order, onChange }: { order: SectionKey[]; onChange: (o: SectionKey[]) => void }) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const a = [...order];
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  return (
    <>
      <p className="m-0 text-[.88rem] text-muted">The order sections appear in. Empty sections are left out of the CV.</p>
      <ol className="m-0 grid list-none gap-1 p-0">
        {order.map((k, i) => (
          <li key={k} className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-band px-3">
            <span><span className="mr-3 font-mono text-[.8rem] text-muted">{i + 1}</span>{SECTION_LABELS[k]}</span>
            <span className="flex gap-1">
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${SECTION_LABELS[k]} up`}>↑</button>
              <button type="button" className={iconBtn} disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${SECTION_LABELS[k]} down`}>↓</button>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
