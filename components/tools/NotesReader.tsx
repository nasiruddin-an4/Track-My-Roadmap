"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth";
import { SignInButton } from "@/components/SignInButton";
import { encode, openImage, readBytes, saveBlob, scaleTo } from "@/lib/tools/browser";
import { DropZone, errorText, FileRow, fileId, move, Notice, Spinner, useObjectUrls } from "./ui";

type Summary = { title: string; points: string[]; terms: { term: string; meaning: string }[] };
type Quiz = { questions: { question: string; options: string[]; answer: number; why: string }[] };
type Page = { id: string; file: File; thumb: string };

const MAX_PAGES = 3;
/** Long side of each photo sent to the AI: sharp enough to read handwriting, small enough to be quick and cheap. */
const SIDE = 1600;

/** Base64 of a JPEG of the photo, shrunk to SIDE px and kept under the server's size limit. */
async function photoToJpeg(file: File): Promise<string> {
  const pic = await openImage(file, SIDE);
  try {
    const canvas = scaleTo(pic.source, pic.width, pic.height, pic.width, pic.height, "#fff");
    let bytes = await readBytes(await encode(canvas, "image/jpeg", 0.82));
    if (bytes.length > 1_150_000) bytes = await readBytes(await encode(canvas, "image/jpeg", 0.6));
    canvas.width = 0;
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  } finally {
    pic.close();
  }
}

async function call<T>(payload: object): Promise<T> {
  const r = await fetch("/api/tools/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
  return j as T;
}

/** Photos of handwritten notes → text (AI), then a revision summary or a practice quiz. Signed-in learners only. */
export function NotesReader({ enabled, readLimit, studyLimit }: { enabled: boolean; readLimit: number; studyLimit: number }) {
  const { ready, user, configured } = useAuth();
  const urls = useObjectUrls();
  const [pages, setPages] = useState<Page[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"read" | "summary" | "quiz" | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [left, setLeft] = useState<{ read?: number; study?: number }>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  // each new quiz starts with no answers picked
  const [quizNo, setQuizNo] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!enabled) {
    return <Notice>The note reader isn’t switched on yet. Every other tool works: try them from the list below.</Notice>;
  }
  if (!configured) return <Notice>The note reader needs accounts, which aren’t set up on this server.</Notice>;
  if (!ready) return <div className="grid min-h-40 place-items-center text-muted" aria-busy="true"><Spinner /></div>;
  if (!user) {
    return (
      <div className="grid gap-5 rounded-2xl border border-line bg-bg/40 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
        <div className="grid gap-2">
          <h2 className="m-0 font-display text-[1.35rem] font-bold">Sign in to read your notes</h2>
          <p className="m-0 max-w-[58ch] text-muted">
            Reading handwriting uses AI, which costs us money for every page, so this tool needs a free account. You get{" "}
            {readLimit} readings a day (up to {MAX_PAGES} pages each) and {studyLimit} summaries or quizzes.
          </p>
        </div>
        <SignInButton primary label="Sign in with Google" />
      </div>
    );
  }

  function add(files: File[]) {
    setError("");
    const room = MAX_PAGES - pages.length;
    if (files.length > room) setNote(`Up to ${MAX_PAGES} pages at a time: read these, then add the next pages.`);
    else setNote("");
    setPages([...pages, ...files.slice(0, Math.max(0, room)).map((file) => ({ id: fileId(), file, thumb: urls.make(file) }))]);
  }

  async function read() {
    setBusy("read");
    setError("");
    try {
      const images = await Promise.all(pages.map((p) => photoToJpeg(p.file)));
      const r = await call<{ found: boolean; text: string; remaining: number }>({ action: "read", images });
      setLeft((l) => ({ ...l, read: r.remaining }));
      if (!r.found) { setError("We couldn’t find any writing in those photos. Take the photo straight on, in good light, with the page filling the frame."); return; }
      // the next pages follow on from the text so far
      setText((t) => (t.trim() ? `${t.trim()}\n---\n${r.text}` : r.text));
      pages.forEach((p) => urls.drop(p.thumb));
      setPages([]);
      setSummary(null);
      setQuiz(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function study(action: "summary" | "quiz") {
    setBusy(action);
    setError("");
    try {
      if (action === "summary") {
        const r = await call<{ summary: Summary; remaining: number }>({ action, text });
        setSummary(r.summary);
        setLeft((l) => ({ ...l, study: r.remaining }));
      } else {
        const r = await call<{ quiz: Quiz; remaining: number }>({ action, text });
        setQuiz(r.quiz);
        setQuizNo((n) => n + 1);
        setLeft((l) => ({ ...l, study: r.remaining }));
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copy your notes:", text); }
  }

  const enough = text.trim().length >= 40;
  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-labelledby="n1">
        <h2 id="n1" className="m-0 font-display text-[1.1rem] font-bold">1. Photos of your notes</h2>
        <DropZone accept="image/*" multiple paste onFiles={add} compact={pages.length > 0}
          title={pages.length ? "Add another page" : "Choose photos of your notes"}
          hint={pages.length ? undefined : `Up to ${MAX_PAGES} pages at a time. Take each photo straight on, in good light.`} />
        {note && <p className="m-0 text-[.9rem] text-warm">{note}</p>}
        {pages.length > 0 && (
          <>
            <ol className="m-0 grid list-none gap-2 p-0" aria-label="Pages, in order">
              {pages.map((p, i) => (
                <FileRow key={p.id} name={p.file.name} size={p.file.size} thumb={p.thumb} index={i} count={pages.length}
                  meta={<span>· page {i + 1}</span>}
                  onMove={busy ? undefined : (a, b) => setPages(move(pages, a, b))}
                  onRemove={busy ? undefined : () => { urls.drop(p.thumb); setPages(pages.filter((x) => x.id !== p.id)); }} />
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn big" onClick={read} disabled={busy !== null}>
                {busy === "read" ? <><Spinner /> Reading your handwriting…</> : `Read ${pages.length === 1 ? "this page" : `these ${pages.length} pages`}`}
              </button>
              {left.read !== undefined && <span className="text-[.88rem] text-muted">{left.read} reading{left.read === 1 ? "" : "s"} left today</span>}
            </div>
          </>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="n2">
        <h2 id="n2" className="m-0 font-display text-[1.1rem] font-bold">2. Your notes as text</h2>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setCopied(false); }} rows={12} spellCheck={false}
          aria-labelledby="n2"
          placeholder="Your notes appear here after reading. You can fix any word, or paste typed notes here instead."
          className="min-h-64 w-full resize-y rounded-2xl border border-line bg-bg p-4 text-[1rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-route" />
        {text.includes("[?]") && <p className="m-0 text-[.88rem] text-muted">[?] marks a word the AI couldn’t read. Check it against your notes.</p>}
        {text && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy text"}</button>
            <button type="button" className="btn" onClick={() => saveBlob(new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" }), "notes.txt")}>Download .txt</button>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="n3">
        <h2 id="n3" className="m-0 font-display text-[1.1rem] font-bold">3. Study them</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn big" onClick={() => study("summary")} disabled={!enough || busy !== null}>
            {busy === "summary" ? <><Spinner /> Summarizing…</> : "Summarize"}
          </button>
          <button type="button" className="btn primary !min-h-[50px] !px-6" onClick={() => study("quiz")} disabled={!enough || busy !== null}>
            {busy === "quiz" ? <><Spinner /> Writing questions…</> : "Quiz me"}
          </button>
          {!enough && <span className="text-[.88rem] text-muted">Read or paste some notes first.</span>}
          {left.study !== undefined && <span className="text-[.88rem] text-muted">{left.study} left today</span>}
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {summary && <SummaryCard s={summary} />}
      {quiz && <QuizCard key={quizNo} quiz={quiz} onAgain={() => study("quiz")} busy={busy !== null} />}
    </div>
  );
}

function SummaryCard({ s }: { s: Summary }) {
  return (
    <article className="grid gap-4 rounded-2xl border border-line bg-bg/50 p-5 sm:p-6" aria-label="Summary">
      <h3 className="m-0 font-display text-[1.3rem] font-bold">{s.title}</h3>
      <ul className="m-0 grid gap-2 pl-5">
        {s.points.map((p, i) => <li key={i} className="leading-relaxed">{p}</li>)}
      </ul>
      {s.terms.length > 0 && (
        <div className="grid gap-2 border-t border-line pt-4">
          <h4 className="m-0 text-[.88rem] font-semibold tracking-wide text-muted uppercase">Key terms</h4>
          <dl className="m-0 grid gap-2">
            {s.terms.map((t, i) => (
              <div key={i} className="grid gap-0.5 sm:grid-cols-[minmax(0,.35fr)_minmax(0,1fr)] sm:gap-4">
                <dt className="font-semibold">{t.term}</dt>
                <dd className="m-0 text-muted">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </article>
  );
}

function QuizCard({ quiz, onAgain, busy }: { quiz: Quiz; onAgain: () => void; busy: boolean }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const answered = picked.filter((p) => p !== null).length;
  const score = picked.filter((p, i) => p === quiz.questions[i].answer).length;
  return (
    <article className="grid gap-5 rounded-2xl border border-line bg-bg/50 p-5 sm:p-6" aria-label="Quiz">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 font-display text-[1.3rem] font-bold">Practice quiz</h3>
        <span className="font-mono text-[.9rem] text-muted" aria-live="polite">{answered === quiz.questions.length ? `Score: ${score} / ${quiz.questions.length}` : `${answered} of ${quiz.questions.length} answered`}</span>
      </div>
      <ol className="m-0 grid list-none gap-6 p-0">
        {quiz.questions.map((q, i) => {
          const p = picked[i];
          return (
            <li key={i} className="grid gap-2.5">
              <p className="m-0 font-semibold"><span className="mr-2 font-mono text-muted">{i + 1}.</span>{q.question}</p>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={`Question ${i + 1} options`}>
                {q.options.map((o, j) => {
                  const right = j === q.answer, chosen = p === j, done = p !== null;
                  return (
                    <button key={j} type="button" disabled={done} onClick={() => setPicked((x) => x.map((v, k) => (k === i ? j : v)))}
                      className={"flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-[.95rem] transition-colors "
                        + (!done ? "border-line hover:border-route hover:bg-route-soft/40"
                          : right ? "border-done bg-done-soft text-ink"
                          : chosen ? "border-danger bg-danger/10 text-ink" : "border-line opacity-60")}>
                      <span className="grid size-6 flex-none place-items-center rounded-full bg-sunk font-mono text-[.75rem]">{"ABCD"[j]}</span>
                      <span>{o}</span>
                      {done && right && <span className="vh">(correct answer)</span>}
                      {chosen && !right && <span className="vh">(your answer, wrong)</span>}
                    </button>
                  );
                })}
              </div>
              {p !== null && (
                <p className={"m-0 text-[.92rem] " + (p === q.answer ? "text-done" : "text-ink")}>
                  {p === q.answer ? "Correct. " : `Not quite: the answer is ${"ABCD"[q.answer]}. `}<span className="text-muted">{q.why}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answered === quiz.questions.length && (
        <button type="button" className="btn w-fit" onClick={onAgain} disabled={busy}>New questions</button>
      )}
    </article>
  );
}
