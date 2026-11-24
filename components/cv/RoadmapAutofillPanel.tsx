"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import type { Suggestions } from "@/lib/cv/autofill";
import type { CvData } from "@/lib/cv/schema";
import { btnOrange } from "./ui";

/**
 * Suggestions from the person's Track My Roadmap progress: a headline, skills from ticked topics and certificates
 * from finished roadmaps. Everything is a checkbox; nothing is added until they press "Add to CV".
 * Suggestions already on the CV aren't offered again, so the panel disappears once there's nothing new.
 */
export function RoadmapAutofillPanel({ data, onApply }: { data: CvData; onApply: (fn: (d: CvData) => CvData) => void }) {
  const toast = useToast();
  const [s, setS] = useState<Suggestions | null>(null);
  const [hidden, setHidden] = useState(false);
  const [useLabel, setUseLabel] = useState(true);
  const [offGroups, setOffGroups] = useState<Set<string>>(new Set());
  const [offWords, setOffWords] = useState<Set<string>>(new Set()); // "<group id>|<word>"
  const [offCerts, setOffCerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    fetch("/api/cv/roadmap-data", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j) setS(j); })
      .catch(() => {}); // suggestions are optional: no panel if they can't load
    return () => { live = false; };
  }, []);

  // only what isn't on the CV yet
  const pending = useMemo(() => {
    if (!s) return null;
    const have = new Set(data.skills.flatMap((g) => g.keywords.map((w) => w.trim().toLowerCase())));
    const certs = new Set(data.certificates.map((c) => c.name.trim().toLowerCase()));
    return {
      label: s.label && !data.basics.label?.trim() ? s.label : null,
      skills: s.skills.map((g) => ({ ...g, keywords: g.keywords.filter((w) => !have.has(w.toLowerCase())) })).filter((g) => g.keywords.length),
      certificates: s.certificates.filter((c) => !certs.has(c.name.toLowerCase())),
    };
  }, [s, data]);

  if (hidden || !pending || (!pending.label && !pending.skills.length && !pending.certificates.length)) return null;

  const toggle = (set: Set<string>, key: string, on: boolean) => { const n = new Set(set); if (on) n.delete(key); else n.add(key); return n; };
  const chosenWords = (g: (typeof pending.skills)[number]) => offGroups.has(g.id) ? [] : g.keywords.filter((w) => !offWords.has(`${g.id}|${w}`));
  const count = (pending.label && useLabel ? 1 : 0) + pending.skills.reduce((n, g) => n + chosenWords(g).length, 0) + pending.certificates.filter((c) => !offCerts.has(c.id)).length;

  const apply = () => {
    const label = pending.label && useLabel ? pending.label : null;
    const groups = pending.skills.map((g) => ({ name: g.group, keywords: chosenWords(g), source: "roadmap" as const })).filter((g) => g.keywords.length);
    const certs = pending.certificates.filter((c) => !offCerts.has(c.id))
      .map((c) => ({ name: c.name, issuer: c.issuer, date: c.date, url: "", source: "trackmyroadmap" as const }));
    onApply((d) => ({
      ...d,
      basics: label ? { ...d.basics, label } : d.basics,
      skills: [...d.skills, ...groups].slice(0, 20),
      certificates: [...d.certificates, ...certs].slice(0, 30),
    }));
    toast(`Added ${count} ${count === 1 ? "item" : "items"} from your roadmaps`);
  };

  return (
    <section className="grid gap-4 rounded-[18px] border border-route/40 bg-route-soft/60 p-5" aria-labelledby="autoH">
      <div className="flex items-start justify-between gap-2">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 id="autoH" className="m-0 font-display text-[1.1rem] font-bold">From your learning on Track My Roadmap</h2>
          <p className="m-0 text-[.88rem] text-muted">Tick what you really know. Only what you choose is added, and you can remove it later.</p>
        </div>
        <button type="button" className="h-9 shrink-0 rounded-lg px-3 text-[.88rem] font-semibold text-muted hover:bg-sunk hover:text-ink" onClick={() => setHidden(true)}>Not now</button>
      </div>

      {pending.label && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface p-3">
          <input type="checkbox" className="size-5 accent-[var(--route)]" checked={useLabel} onChange={(e) => setUseLabel(e.target.checked)} />
          <span>Headline: <b>{pending.label}</b></span>
        </label>
      )}

      {pending.skills.length > 0 && (
        <div className="grid gap-2">
          <span className="font-mono text-[.72rem] tracking-[.08em] text-muted uppercase">Skills from ticked topics</span>
          {pending.skills.map((g) => {
            const on = !offGroups.has(g.id);
            return (
              <div key={g.id} className="grid gap-2 rounded-xl bg-surface p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" className="size-5 accent-[var(--route)]" checked={on} onChange={(e) => setOffGroups((x) => toggle(x, g.id, e.target.checked))} />
                  <span><b>{g.group}</b> <span className="text-[.82rem] text-muted">· {g.roadmap}</span></span>
                </label>
                {on && (
                  <div className="flex flex-wrap gap-1.5 pl-8">
                    {g.keywords.map((w) => {
                      const k = `${g.id}|${w}`, picked = !offWords.has(k);
                      return (
                        <button key={w} type="button" aria-pressed={picked} onClick={() => setOffWords((x) => toggle(x, k, !picked))}
                          className={"min-h-8 rounded-full border px-3 text-[.85rem] transition " + (picked ? "border-route/60 bg-route-soft text-ink" : "border-line text-muted line-through")}>
                          {w}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pending.certificates.length > 0 && (
        <div className="grid gap-2">
          <span className="font-mono text-[.72rem] tracking-[.08em] text-muted uppercase">Certificates</span>
          {pending.certificates.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface p-3">
              <input type="checkbox" className="size-5 accent-[var(--route)]" checked={!offCerts.has(c.id)} onChange={(e) => setOffCerts((x) => toggle(x, c.id, e.target.checked))} />
              <span><b>{c.name}</b> <span className="text-[.85rem] text-muted">· {c.issuer}</span></span>
            </label>
          ))}
        </div>
      )}

      <button type="button" className={btnOrange + " h-11 justify-self-start"} disabled={!count} onClick={apply}>
        Add {count} to CV
      </button>
    </section>
  );
}
