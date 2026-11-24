"use client";

import { useState } from "react";
import { cleanBullet } from "@/lib/cv/format";

/* "Write my summary" and "Improve this bullet": the AI's version next to the original; the person decides. */

async function ask(body: object): Promise<string> {
  const r = await fetch("/api/cv/rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "That didn’t work. Please try again.");
  return j.suggestion as string;
}

/** Text with [X] placeholders picked out, so they're easy to spot and fill in. */
function Marked({ text }: { text: string }) {
  return <>{text.split(/(\[X[^\]]*\])/g).map((part, i) => (/^\[X/.test(part) ? <mark key={i} className="rounded bg-warm/25 px-0.5 text-warm">{part}</mark> : part))}</>;
}

const sparkBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[.86rem] font-semibold text-ink transition hover:border-route hover:text-route disabled:opacity-50";

function Compare({ before, after, onAccept, onRetry, onDiscard, busy }: {
  before: string; after: string; onAccept: () => void; onRetry: () => void; onDiscard: () => void; busy: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-route/40 bg-route-soft/50 p-3" role="group" aria-label="AI suggestion">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-1">
          <span className="font-mono text-[.7rem] tracking-[.06em] text-muted uppercase">Now</span>
          <p className="m-0 text-[.9rem] text-muted">{before || "—"}</p>
        </div>
        <div className="grid content-start gap-1">
          <span className="font-mono text-[.7rem] tracking-[.06em] text-route uppercase">Suggested</span>
          <p className="m-0 text-[.9rem]"><Marked text={after} /></p>
        </div>
      </div>
      {/\[X/.test(after) && <p className="m-0 text-[.8rem] text-warm">Replace each [X] with your real number, or delete it, before you send your CV.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="h-9 rounded-lg bg-route px-3 text-[.86rem] font-semibold text-route-ink" onClick={onAccept}>Use this</button>
        <button type="button" className="h-9 rounded-lg border border-line px-3 text-[.86rem] font-semibold" onClick={onRetry} disabled={busy}>{busy ? "Writing…" : "Try again"}</button>
        <button type="button" className="h-9 rounded-lg px-3 text-[.86rem] font-semibold text-muted hover:text-ink" onClick={onDiscard}>Discard</button>
      </div>
    </div>
  );
}

/** Under the summary box. Saves first: the summary is written from the saved CV and the person's roadmaps. */
export function SummaryAssist({ cvId, current, flush, onAccept }: { cvId: string; current: string; flush: () => Promise<boolean>; onAccept: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      if (!(await flush())) throw new Error("Fix the form first, then try again.");
      setSuggestion(await ask({ kind: "summary", cvId }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2">
      {suggestion === null && (
        <button type="button" className={sparkBtn + " justify-self-start"} onClick={run} disabled={busy}>
          ✨ {busy ? "Writing…" : current.trim() ? "Improve my summary" : "Write my summary"}
        </button>
      )}
      {suggestion !== null && (
        <Compare before={current} after={suggestion} busy={busy} onRetry={run} onDiscard={() => setSuggestion(null)}
          onAccept={() => { onAccept(suggestion); setSuggestion(null); }} />
      )}
      {error && <p className="m-0 text-[.85rem] text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Under a job's or project's bullet points: an "Improve" button for each one. */
export function BulletAssist({ cvId, bullets, position, company, onReplace }: {
  cvId: string; bullets: string[]; position?: string; company?: string; onReplace: (index: number, text: string) => void;
}) {
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const lines = bullets.map((b, i) => ({ i, text: cleanBullet(b) })).filter((b) => b.text.length >= 3);
  if (!lines.length) return null;

  const run = async (i: number) => {
    setAt(i);
    setBusy(true);
    setError("");
    setSuggestion(null);
    try {
      setSuggestion(await ask({ kind: "bullet", cvId, text: cleanBullet(bullets[i]), position, company }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-1.5">
      <span className="text-[.8rem] font-semibold text-muted">Improve a point with AI</span>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {lines.map(({ i, text }) => (
          <li key={i} className="grid gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-bg px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[.88rem] text-muted">{text}</span>
              <button type="button" className={sparkBtn + " h-8 shrink-0"} onClick={() => run(i)} disabled={busy}
                aria-label={`Improve: ${text}`}>{busy && at === i ? "Writing…" : "✨ Improve"}</button>
            </div>
            {at === i && suggestion !== null && (
              <Compare before={text} after={suggestion} busy={busy} onRetry={() => run(i)} onDiscard={() => { setSuggestion(null); setAt(null); }}
                onAccept={() => { onReplace(i, suggestion); setSuggestion(null); setAt(null); }} />
            )}
            {at === i && error && <p className="m-0 text-[.85rem] text-danger" role="alert">{error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
