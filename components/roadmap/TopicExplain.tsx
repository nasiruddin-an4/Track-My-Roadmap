"use client";

import { useEffect, useState } from "react";

/*
 * "What is this?" under a roadmap topic: a short explanation written by the AI (app/api/explain), so learners know
 * what a topic is before they start it. Kept in this browser once loaded, so reopening is instant.
 */

const mem = new Map<string, string>();
const storeKey = (slug: string) => `tmr-explain:${slug}`;
const MAX_STORED = 400;

function readStore(slug: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(storeKey(slug)) ?? "{}") as Record<string, string>; } catch { return {}; }
}
function cached(slug: string, key: string): string | undefined {
  return mem.get(`${slug}|${key}`) ?? readStore(slug)[key];
}
function keep(slug: string, key: string, text: string) {
  mem.set(`${slug}|${key}`, text);
  try {
    const all = readStore(slug);
    all[key] = text;
    const keys = Object.keys(all);
    if (keys.length > MAX_STORED) delete all[keys[0]];
    localStorage.setItem(storeKey(slug), JSON.stringify(all));
  } catch {}
}

export function ExplainButton({ topic, open, controls, onToggle }: { topic: string; open: boolean; controls: string; onToggle: () => void }) {
  return (
    <button type="button" className="ex-b" aria-expanded={open} aria-controls={controls} aria-label={`What is ${topic}?`} title="What is this?" onClick={onToggle}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.6" /><path d="M12 18.2h.01" />
      </svg>
    </button>
  );
}

type State = { text?: string; error?: string };

export function ExplainPanel({ id, slug, topicKey, topic }: { id: string; slug: string; topicKey: string; topic: string }) {
  const [state, setState] = useState<State>(() => ({ text: cached(slug, topicKey) }));
  const [attempt, setAttempt] = useState(0);
  const { text, error } = state;

  useEffect(() => {
    if (text || error) return;
    let live = true;
    fetch(`/api/explain?roadmap=${encodeURIComponent(slug)}&key=${encodeURIComponent(topicKey)}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!r.ok || !j.text) throw new Error(j.error || "We couldn’t load the explanation. Please try again.");
        return j.text;
      })
      .then((t) => { if (!live) return; keep(slug, topicKey, t); setState({ text: t }); })
      .catch((e: Error) => { if (live) setState({ error: e.message }); });
    return () => { live = false; };
  }, [slug, topicKey, text, error, attempt]);

  return (
    <div id={id} className="explain" role="region" aria-label={`About ${topic}`} aria-live="polite" aria-busy={!text && !error}>
      {text ? <p>{text}</p>
        : error ? (
          <p className="ex-err">{error}{" "}
            <button type="button" className="link" onClick={() => { setState({}); setAttempt((a) => a + 1); }}>Try again</button>
          </p>
        ) : (
          <span className="ex-load"><i /><i /><i /><span className="vh">Loading an explanation of {topic}…</span></span>
        )}
      {text && <span className="ex-note">Written by AI, so it may not be perfect.</span>}
    </div>
  );
}
