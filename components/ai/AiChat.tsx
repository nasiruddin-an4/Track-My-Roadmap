"use client";

/*
 * The AI Tutor chat (/ai). The tutor (app/api/assistant) recommends roadmaps and writes [[roadmap:slug]] markers,
 * which show here as cards with "Start" and "View" buttons. The conversation is kept for this browser tab. Signed-in learners' progress is read on the server; this
 * browser's progress is sent along for the case where there's no account to read.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHAT_KEY, Sparkle } from "@/components/ai/shared";
import { useAuth } from "@/components/auth";
import { Arrow } from "@/components/icons";
import { SignInButton } from "@/components/SignInButton";
import { readJSON } from "@/lib/storage";
import { useLocalItem } from "@/lib/useLocal";

export type GuideRoadmap = {
  slug: string; title: string; tagline: string; category: string; level: string;
  localKey: string; phases: number; topics: number; phaseTitles: string[];
};
type Turn = { role: "user" | "assistant"; content: string };
type ChatError = { text: string };
/** Today's messages: guests get a few free ones, then must sign in to keep chatting. */
type Quota = { signedIn: boolean; remaining: number; limit: number; memberLimit?: number };

/** Quick starts under the box on an empty chat: label, and the question it sends. */
const SUGGESTIONS: [string, string][] = [
  ["System design engineer", "I want to become a system design engineer"],
  ["Digital marketer", "I want to become a digital marketer"],
  ["AI engineer", "I want to become an AI engineer"],
  ["New to coding", "I’m completely new to coding. Where should I start?"],
];

function loadChat(): Turn[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((t): t is Turn => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string") : [];
  } catch { return []; }
}
function saveChat(turns: Turn[]) {
  try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(turns.slice(-30))); } catch {}
}

export function AiChat({ roadmaps }: { roadmaps: GuideRoadmap[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const locked = !!quota && !quota.signedIn && quota.remaining <= 0; // a guest who has used the free messages
  const abort = useRef<AbortController | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const started = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);

  const show = (t: Turn[]) => { turnsRef.current = t; setTurns(t); };

  async function ask(question: string) {
    const q = question.trim().slice(0, 1200);
    if (!q || abort.current || locked) return;
    setDraft("");
    setError(null);
    const history: Turn[] = [...turnsRef.current, { role: "user", content: q }];
    show([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    // this browser's progress, by slug (the server prefers the account's copy when signed in)
    const local: Record<string, string[]> = {};
    for (const r of roadmaps) {
      const d = readJSON<{ done?: unknown }>(r.localKey);
      if (Array.isArray(d?.done) && d.done.length) local[r.slug] = d.done.filter((k): k is string => typeof k === "string");
    }

    const setReply = (text: string) => show([...history, { role: "assistant", content: text }]);
    const ctl = (abort.current = new AbortController());
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, local }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        const info = (await res.json().catch(() => ({}))) as { error?: string; signedIn?: boolean; limit?: number };
        show(history);
        if (res.status === 429) {
          const signedIn = !!info.signedIn;
          setQuota((q) => ({ ...q, signedIn, remaining: 0, limit: info.limit ?? q?.limit ?? 0 }));
          // a guest gets the sign-in card in place of the message box instead of an error line
          if (signedIn) setError({ text: info.error ?? "You’ve used today’s AI Tutor messages. They reset tomorrow." });
        } else setError({ text: info.error ?? "The AI Tutor couldn’t answer. Please try again." });
        return;
      }
      const n = Number(res.headers.get("X-Assistant-Remaining"));
      if (Number.isFinite(n)) {
        const signedIn = res.headers.get("X-Assistant-Signed-In") === "1";
        setQuota((q) => ({ ...q, signedIn, remaining: n, limit: Number(res.headers.get("X-Assistant-Limit")) || q?.limit || 0 }));
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setReply(text);
      }
      if (text.includes("[[busy]]")) {
        text = text.replace("[[busy]]", "").trim();
        setError({ text: "The AI Tutor is busy right now. Please try again in a minute." });
      } else if (text.includes("[[error]]")) {
        text = text.replace("[[error]]", "").trim();
        setError({ text: "The answer was cut off. Please ask again." });
      }
      if (text.trim()) setReply(text); else show(history);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      show(history);
      setError({ text: "Couldn’t reach the AI Tutor. Check your connection and try again." });
    } finally {
      if (abort.current === ctl) abort.current = null;
      setBusy(false);
      saveChat(turnsRef.current);
      input.current?.focus();
    }
  }

  // on open: bring back this tab's conversation
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = loadChat();
    if (saved.length) queueMicrotask(() => show(saved));
  }, []);

  useEffect(() => () => abort.current?.abort(), []);

  // how many messages are left today (again after signing in or out)
  useEffect(() => {
    let live = true;
    fetch("/api/assistant", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((q: Quota | null) => { if (live && q) setQuota(q); })
      .catch(() => {});
    return () => { live = false; };
  }, [uid]);

  // keep the newest message in view while it streams
  useEffect(() => {
    if (turns.length) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [turns, error]);

  function newChat() {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
    setError(null);
    show([]);
    saveChat([]);
    input.current?.focus();
  }

  const byslug = new Map(roadmaps.map((r) => [r.slug, r]));

  const composer = (big: boolean) => (
    <form onSubmit={(e) => { e.preventDefault(); ask(draft); }}
      className={"grid gap-3 rounded-[20px] border border-line bg-surface shadow-[var(--shadow)] transition focus-within:border-route " + (big ? "p-4 sm:p-5" : "p-2.5 sm:p-3")}>
      <textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200} autoFocus
        rows={big ? 3 : 1} aria-label="Message the AI Tutor"
        placeholder={big ? "I want to move into backend. I know Python basics but nothing about databases." : "Ask a follow-up…"}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter adds a line
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(draft); }
        }}
        className={"field-sizing-content max-h-48 w-full resize-none bg-transparent px-1.5 text-ink placeholder:text-muted/80 focus:outline-none " + (big ? "min-h-[84px] text-[1.05rem] leading-relaxed" : "min-h-6 py-2 text-base")} />
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-bg/60 px-3 py-1.5 text-[.82rem] font-semibold text-muted">
          <span className="text-highlight"><Sparkle size={14} /></span>
          {big ? `Picks from ${roadmaps.length} free roadmaps` : "AI Tutor"}
        </span>
        {quota && (quota.signedIn
          ? <span className="text-[.78rem] text-muted max-sm:hidden">{quota.remaining} message{quota.remaining === 1 ? "" : "s"} left today</span>
          : <span className="text-[.78rem] text-muted">
              <b className="font-semibold text-ink">{quota.remaining}</b> free message{quota.remaining === 1 ? "" : "s"} left
              <span className="max-sm:hidden"> · <Link href="/login?next=/ai" className="font-semibold text-route hover:underline">Sign in</Link> for more</span>
            </span>)}
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send"
          className="ml-auto grid size-11 flex-none place-items-center rounded-full bg-route text-route-ink transition hover:brightness-110 disabled:bg-sunk disabled:text-muted">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>
        </button>
      </div>
    </form>
  );

  return (
    <main className="mx-auto grid min-h-[calc(100svh-var(--top))] w-full max-w-[820px] grid-rows-[1fr_auto] px-4 sm:px-6">
      <div className={"grid content-start gap-5 " + (turns.length ? "pt-8 pb-6 sm:pt-12" : "")} aria-live="polite">
        {turns.length === 0 ? (
          <div className="grid gap-8 pt-[12vh] pb-10 sm:pt-[16vh]">
            <div className="grid justify-items-center gap-3 text-center">
              <h1 className="m-0 font-display text-[clamp(2.1rem,6vw,3.4rem)] leading-[1.06] font-bold tracking-[-.035em] text-balance">
                What do you want to <span className="text-highlight">become?</span>
              </h1>
              <p className="m-0 max-w-[52ch] text-[clamp(1rem,2.2vw,1.2rem)] leading-relaxed text-muted">
                The more you share about your goal and what you already know, the better the roadmap it picks for you.
              </p>
            </div>
            {locked ? <GuestGate quota={quota} /> : composer(true)}
            <div className={"flex flex-wrap justify-center gap-x-6 gap-y-3 " + (locked ? "hidden" : "")}>
              {SUGGESTIONS.map(([label, q]) => (
                <button key={label} type="button" onClick={() => ask(q)}
                  className="border-b border-dotted border-muted/60 pb-0.5 text-[.95rem] text-muted transition hover:border-route hover:text-ink">
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <h1 className="m-0 flex items-center gap-2 font-display text-[1.15rem] font-bold">
                <span className="text-highlight"><Sparkle /></span> AI Tutor
              </h1>
              <button type="button" onClick={newChat} className="rounded-[10px] border border-line px-3 py-1.5 text-[.85rem] font-semibold text-muted hover:border-muted hover:text-ink">
                New chat
              </button>
            </div>
            {turns.map((t, i) => t.role === "user" ? (
              <p key={i} className="m-0 max-w-[85%] justify-self-end rounded-[20px] rounded-br-[6px] bg-route-soft px-4 py-2.5 whitespace-pre-wrap shadow-[0_1px_0_rgba(255,255,255,.04)_inset]">{t.content}</p>
            ) : (
              <div key={i} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                <span className="mt-0.5 grid size-[34px] place-items-center rounded-full bg-[#FF5A00]/15 text-highlight ring-1 ring-[#FF5A00]/25" aria-hidden="true"><Sparkle size={17} /></span>
                <div className="grid min-w-0 gap-3.5 text-[1rem] leading-relaxed">
                  <span className="sr-only">AI Tutor:</span>
                  {t.content ? <Reply text={t.content} streaming={busy && i === turns.length - 1} byslug={byslug} />
                    : <span className="inline-flex h-8 items-center gap-2 text-muted"><Dots /> Thinking…</span>}
                  {/* tap-to-answer chips for the tutor's follow-up question (latest reply only) */}
                  {i === turns.length - 1 && !busy && !locked && <QuickReplies text={t.content} onPick={ask} />}
                </div>
              </div>
            ))}
          </>
        )}
        {error && (
          <div role="alert" className="grid justify-items-start gap-3 rounded-[14px] border border-line bg-surface/60 px-4 py-3 text-[.95rem]">
            <span>{error.text}</span>
          </div>
        )}
      </div>

      {turns.length > 0 && (
        <div className="sticky bottom-0 grid gap-1.5 bg-gradient-to-t from-bg from-70% to-transparent pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">
          {locked ? <GuestGate quota={quota} /> : composer(false)}
          <p className="m-0 text-center text-[.75rem] text-muted">AI suggestions can be wrong; check the roadmap before you commit.</p>
        </div>
      )}
    </main>
  );
}

/** In place of the message box once a guest has used the free messages: sign in to keep chatting. */
function GuestGate({ quota }: { quota: Quota | null }) {
  const { configured } = useAuth();
  return (
    <div className="relative grid justify-items-center gap-3 overflow-hidden rounded-[20px] border border-route/40 bg-surface p-5 text-center shadow-[var(--shadow)] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,149,255,.25),transparent)]" />
      <span className="relative grid size-11 place-items-center rounded-full bg-[#FF5A00]/15 text-highlight ring-1 ring-[#FF5A00]/25" aria-hidden="true"><Sparkle size={20} /></span>
      <h2 className="relative m-0 font-display text-[1.2rem] font-bold">
        You’ve used your {quota?.limit || "free"} free message{quota?.limit === 1 ? "" : "s"}
      </h2>
      <p className="relative m-0 max-w-[46ch] text-[.95rem] leading-relaxed text-muted">
        {configured
          ? <>Sign in with Google to keep chatting with the AI Tutor. It’s free, your chat stays right here, and the tutor can use your saved progress to suggest what to learn next.</>
          : <>You’ve reached today’s limit. Please come back tomorrow.</>}
      </p>
      <span className="relative"><SignInButton primary label="Continue with Google" next="/ai" /></span>
      {configured && quota?.memberLimit ? <span className="relative text-[.78rem] text-muted">{quota.memberLimit} messages a day when you’re signed in</span> : null}
    </div>
  );
}

const Dots = () => (
  <span className="inline-flex gap-1" aria-hidden="true">
    {[0, 1, 2].map((i) => <i key={i} className="size-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />)}
  </span>
);

/*
 * A reply is plain text plus markers the tutor writes on their own lines (see lib/assistant/prompt.ts):
 *   [[roadmap:slug]]          a recommendation card; the next line of text is the reason, shown inside it
 *   [[start:slug:3]]          a "Start here" box for that phase
 *   [[replies:a|b|c]]         tap-to-answer chips for the closing question
 *   [[page:habits]]           a button to a page of the site (keys in PAGES)
 */
type Block =
  | { k: "p"; text: string }
  | { k: "ul"; items: string[]; nested?: boolean }
  | { k: "ol"; start: number; items: string[] }
  | { k: "page"; key: string }
  | { k: "card"; slug: string; reason: string }
  | { k: "start"; slug: string; phase: number; note: string };

const MARKER = /\[\[(roadmap|start|replies|page):([^\]\n]*)\]\]/g;

function parseReply(text: string, streaming: boolean): { blocks: Block[]; replies: string[] } {
  // while streaming, hide a marker that has only half arrived
  const src = streaming ? text.replace(/\[\[[^\]\n]*\]?$/, "") : text;
  const blocks: Block[] = [];
  let replies: string[] = [];
  let waiting: Extract<Block, { k: "card" | "start" }> | null = null; // takes the next line of text as its reason
  for (const raw of src.split("\n")) {
    let rest = raw;
    const pages: Block[] = []; // page buttons written inside a line go after that line's text
    for (const [m, kind, arg] of raw.matchAll(MARKER)) {
      rest = rest.replace(m, "");
      if (kind === "roadmap") { waiting = { k: "card", slug: arg.trim(), reason: "" }; blocks.push(waiting); }
      else if (kind === "start") {
        const [slug, n] = arg.split(":");
        waiting = { k: "start", slug: (slug ?? "").trim(), phase: Number(n) || 1, note: "" };
        blocks.push(waiting);
      } else if (kind === "page") {
        const key = arg.trim();
        if (PAGES[key] && ![...blocks, ...pages].some((b) => b.k === "page" && b.key === key)) pages.push({ k: "page", key });
      } else replies = arg.split("|").map((r) => r.trim()).filter(Boolean).slice(0, 4).map((r) => r.slice(0, 60));
    }
    // tidy what a marker leaves behind: "[[roadmap:x]] – why" and "Open the page – [[page:x]]."
    const hadMarker = rest !== raw;
    let line = rest.replace(/\[\[[^\]]*\]\]/g, "");
    if (hadMarker) line = line.replace(/^\s*[-–—:]\s+/, "").replace(/\s*[-–—:]\s*([.!]?)\s*$/, "$1").replace(/\s+([.!,])$/, "$1");
    line = line.trim();
    if (!line) { blocks.push(...pages); if (pages.length) waiting = null; continue; }
    const bullet = /^[-*•]\s+/.test(line);
    const step = /^\d{1,2}[.)]\s+/.test(line);
    if (waiting && !bullet && !step) {
      if (waiting.k === "card") waiting.reason = line; else waiting.note = line;
      waiting = null;
      blocks.push(...pages);
      continue;
    }
    waiting = null;
    if (bullet || step) {
      const k = bullet ? "ul" : "ol";
      const item = line.replace(bullet ? /^[-*•]\s+/ : /^\d{1,2}[.)]\s+/, "");
      const last = blocks[blocks.length - 1];
      if (last && (last.k === "ul" || last.k === "ol") && last.k === k) last.items.push(item);
      // steps split by a button or bullets keep their own numbers ("2." after a page button stays 2);
      // indented bullets right after a step are that step's sub-points
      else blocks.push(k === "ul" ? { k, items: [item], nested: /^\s{2,}/.test(raw) && last?.k === "ol" } : { k, start: parseInt(line, 10) || 1, items: [item] });
    } else blocks.push({ k: "p", text: line });
    blocks.push(...pages);
  }
  return { blocks, replies };
}

function Reply({ text, streaming, byslug }: { text: string; streaming: boolean; byslug: Map<string, GuideRoadmap> }) {
  const { blocks } = parseReply(text, streaming);
  let rank = 0;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.k === "p") {
          const question = b.text.endsWith("?") && i === blocks.length - 1;
          return <p key={i} className={"m-0 " + (question ? "font-semibold text-ink" : "text-ink/90")}>{inline(b.text)}</p>;
        }
        if (b.k === "ul") return <ul key={i} className={"m-0 grid list-disc gap-1 text-ink/90 marker:text-highlight " + (b.nested ? "-mt-1.5 pl-[56px] text-[.95rem]" : "pl-5")}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
        if (b.k === "ol") return (
          <ol key={i} className="m-0 grid list-none gap-2 p-0">
            {b.items.map((it, j) => (
              <li key={j} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5 text-ink/90">
                <span className="mt-0.5 grid size-[26px] place-items-center rounded-full bg-route-soft font-mono text-[.78rem] font-medium text-route" aria-hidden="true">{b.start + j}</span>
                <span>{inline(it)}</span>
              </li>
            ))}
          </ol>
        );
        if (b.k === "page") return <PageLink key={i} page={PAGES[b.key]} />;
        const rm = byslug.get(b.slug);
        if (!rm) return null;
        if (b.k === "card") return <RoadmapCard key={i} rm={rm} reason={b.reason} rank={rank++} />;
        return <StartHere key={i} rm={rm} phase={Math.min(Math.max(1, b.phase), rm.phaseTitles.length)} note={b.note} />;
      })}
    </>
  );
}

function QuickReplies({ text, onPick }: { text: string; onPick: (q: string) => void }) {
  const { replies } = parseReply(text, false);
  if (!replies.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-0.5" role="group" aria-label="Quick answers">
      {replies.map((r) => (
        <button key={r} type="button" onClick={() => onPick(r)}
          className="rounded-full border border-route/40 bg-route-soft/60 px-3.5 py-1.5 text-[.88rem] font-semibold text-ink transition hover:border-route hover:bg-route-soft motion-safe:hover:-translate-y-px">
          {r}
        </button>
      ))}
    </div>
  );
}

function inline(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part);
}

/** Pages the tutor can point to with [[page:key]]. `guest` is where a signed-out visitor goes instead. */
type SitePage = { title: string; desc: string; href: string; guest?: string; icon: React.ReactNode };
const PAGES: Record<string, SitePage> = {
  habits: { title: "Open the habit tracker", desc: "Tick off today’s habits and watch your month fill in", href: "/habits/track", guest: "/habits",
    icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4M9 15l2 2 4-4" /></> },
  roadmaps: { title: "Browse all roadmaps", desc: "Browse every free career and skill roadmap", href: "/roadmaps",
    icon: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></> },
  "my-roadmaps": { title: "Open My roadmaps", desc: "Every roadmap you’ve started, and how far you are", href: "/account/roadmaps",
    icon: <path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11V20" /> },
  activity: { title: "Open your Activity", desc: "Streaks, progress and where to continue", href: "/account",
    icon: <path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /> },
  "road-card": { title: "Open your Road Card", desc: "Share your progress on LinkedIn and more", href: "/account/card",
    icon: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16a3 3 0 0 1 6 0M14 10h4.5M14 13.5h3" /></> },
  certificates: { title: "See your certificates", desc: "Earned when you finish every phase of a roadmap", href: "/account/certificates",
    icon: <><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" /></> },
  friends: { title: "Open Friends", desc: "Coming soon; invite friends to learn with you", href: "/account/friends",
    icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></> },
  profile: { title: "Open your profile", desc: "Your name, photo and public details", href: "/account/profile",
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></> },
};

/** A button-card to a page of the site. */
function PageLink({ page }: { page: SitePage }) {
  const { configured, user } = useAuth();
  const href = page.guest && configured && !user ? page.guest : page.href;
  return (
    <Link href={href}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[16px] border border-line bg-surface/80 p-3.5 transition hover:border-route/60 hover:bg-surface motion-safe:hover:-translate-y-px">
      <span className="grid size-10 place-items-center rounded-[12px] bg-route-soft text-route" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{page.icon}</svg>
      </span>
      <span className="grid min-w-0">
        <span className="font-semibold">{page.title}</span>
        <span className="truncate text-[.85rem] text-muted">{page.desc}</span>
      </span>
      <span className="grid size-9 place-items-center rounded-full bg-route text-route-ink transition motion-safe:group-hover:translate-x-0.5" aria-hidden="true"><Arrow /></span>
    </Link>
  );
}

const PathIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8 18h5a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8h5" /></svg>
);
const SkillIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" /></svg>
);

/** A recommended roadmap. The first one gets the "Best match" badge and a highlighted border. */
function RoadmapCard({ rm, reason, rank }: { rm: GuideRoadmap; reason: string; rank: number }) {
  const best = rank === 0;
  const skill = rm.category.toLowerCase() === "skill";
  return (
    <article className={"relative grid gap-3.5 overflow-hidden rounded-[18px] border bg-surface/80 p-4 sm:p-5 " +
      (best ? "border-route/50 shadow-[0_12px_40px_-18px_rgba(124,149,255,.55)]" : "border-line")}>
      {best && <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-[radial-gradient(closest-side,rgba(124,149,255,.22),transparent)]" />}
      <div className="relative flex flex-wrap items-center gap-2.5">
        <span className={"grid size-8 place-items-center rounded-[10px] " + (skill ? "bg-[#FF5A00]/15 text-highlight" : "bg-route-soft text-route")}>
          {skill ? <SkillIcon /> : <PathIcon />}
        </span>
        <span className={"font-mono text-[.72rem] font-medium tracking-[.1em] uppercase " + (skill ? "text-highlight" : "text-route")}>
          {skill ? "Skill roadmap" : rm.category}
        </span>
        <span className="text-[.78rem] text-muted max-sm:hidden">· {rm.level}</span>
        <span className={"ml-auto rounded-full px-2.5 py-1 text-[.72rem] font-semibold " +
          (best ? "bg-[#FF5A00]/15 text-highlight ring-1 ring-[#FF5A00]/30" : "bg-sunk text-muted")}>
          {best ? "★ Best match" : "Also fits"}
        </span>
      </div>
      <div className="relative grid gap-1.5">
        <h3 className="m-0 font-display text-[1.2rem] leading-tight font-bold">{rm.title}</h3>
        <p className="m-0 text-[.95rem] leading-snug text-ink/85">{reason ? inline(reason) : rm.tagline}</p>
      </div>
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="rounded-[8px] bg-sunk px-2 py-1 font-mono text-[.75rem] text-muted"><b className="font-medium text-ink">{rm.phases}</b> phases</span>
        <span className="rounded-[8px] bg-sunk px-2 py-1 font-mono text-[.75rem] text-muted"><b className="font-medium text-ink">{rm.topics}</b> topics</span>
        <span className="ml-auto flex flex-wrap gap-2 max-sm:ml-0 max-sm:w-full">
          <StartLink rm={rm} href={`/roadmaps/${rm.slug}/track`} label="Start this roadmap" primary={best} />
          <Link href={`/roadmaps/${rm.slug}`} className="inline-flex min-h-10 items-center rounded-[11px] border border-line px-4 text-[.9rem] font-semibold transition hover:border-muted">
            View
          </Link>
        </span>
      </div>
    </article>
  );
}

/** "Start here": the phase the tutor suggests beginning with, linked straight to it in the tracker. */
function StartHere({ rm, phase, note }: { rm: GuideRoadmap; phase: number; note: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 rounded-[18px] border border-[#FF5A00]/30 bg-[linear-gradient(135deg,rgba(255,90,0,.10),rgba(255,90,0,.03))] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span className="grid size-10 place-items-center rounded-full bg-[#FF5A00]/15 text-highlight" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
      </span>
      <div className="grid min-w-0 gap-0.5">
        <span className="font-mono text-[.7rem] font-medium tracking-[.12em] text-highlight uppercase">Start here</span>
        <span className="font-semibold leading-snug">Phase {phase} · {rm.phaseTitles[phase - 1]}</span>
        <span className="text-[.85rem] leading-snug text-muted">{note ? inline(note) : `in ${rm.title}`}</span>
      </div>
      <span className="col-span-2 sm:col-span-1">
        <StartLink rm={rm} href={`/roadmaps/${rm.slug}/track#phase-${phase}`} label={`Open phase ${phase}`} primary />
      </span>
    </div>
  );
}

/** Signed in (or no accounts set up): straight to the tracker. Signed out: Google sign-in, then back to it. */
function StartLink({ rm, href, label, primary }: { rm: GuideRoadmap; href: string; label: string; primary: boolean }) {
  const { configured, ready, user } = useAuth();
  const started = useStarted(rm.localKey);
  // signed out: one "Start with Google" (the best match); the others stay short so the reply isn't a wall of them
  if (configured && !user) {
    const text = label === "Start this roadmap" ? (primary ? "Start with Google" : "Start") : label;
    return ready ? <SignInButton variant="default" label={text} next={href} /> : null;
  }
  return (
    <Link href={href}
      className={"group inline-flex min-h-10 items-center gap-2 rounded-[11px] px-4 text-[.9rem] font-semibold transition " +
        (primary ? "bg-route text-route-ink hover:brightness-110" : "border border-line hover:border-muted")}>
      {started && label === "Start this roadmap" ? "Continue" : label}
      <span className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"><Arrow /></span>
    </Link>
  );
}

/** Whether this browser already has ticks on the roadmap (for "Continue" vs "Start"). */
function useStarted(localKey: string): boolean {
  const raw = useLocalItem(localKey);
  try { return ((JSON.parse(raw ?? "null") as { done?: unknown[] } | null)?.done?.length ?? 0) > 0; } catch { return false; }
}
