"use client";

/*
 * The feedback form on every page (except /admin), opened by any link to "#feedback" (the footer has one).
 * Signed-in learners send an optional rating, a kind and a message; the page they were on
 * is attached. Signed-out visitors are asked to sign in and come straight back to the form.
 */
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth";
import { Close } from "@/components/icons";
import { SignInButton } from "@/components/SignInButton";
import { getSupabase } from "@/lib/supabase/client";

type Kind = "idea" | "bug" | "content" | "other";
const KINDS: { v: Kind; label: string; hint: string }[] = [
  { v: "idea", label: "💡 Idea", hint: "What would make this more useful for you?" },
  { v: "bug", label: "🐞 Something broke", hint: "What happened, and what did you expect? Which device?" },
  { v: "content", label: "📚 Roadmap or topic", hint: "Which roadmap or topic is missing, wrong or unclear?" },
  { v: "other", label: "💬 Other", hint: "Tell us anything." },
];
const RATINGS = [
  { v: 1, face: "😞", label: "Not useful" },
  { v: 2, face: "🙁", label: "A little useful" },
  { v: 3, face: "😐", label: "Okay" },
  { v: 4, face: "🙂", label: "Useful" },
  { v: 5, face: "😍", label: "Very useful" },
];

/*
 * Open/closed lives in a tiny store rather than being read from the address each render: "#feedback" is
 * recorded as soon as this script loads (some pages' prefetching rewrites the address moments later), and links
 * to "#feedback" clicked later open it through the hashchange event.
 */
let wanted = typeof window !== "undefined" &&
  ((window as unknown as { __tmrHash?: string }).__tmrHash ?? window.location.hash) === "#feedback";
const listeners = new Set<() => void>();
function setWanted(v: boolean) { wanted = v; listeners.forEach((l) => l()); }
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onHash = () => { if (location.hash === "#feedback") setWanted(true); };
  window.addEventListener("hashchange", onHash);
  return () => { listeners.delete(cb); window.removeEventListener("hashchange", onHash); };
}
const useWanted = () => useSyncExternalStore(subscribe, () => wanted, () => false);

export function FeedbackButton() {
  const path = usePathname();
  const open = useWanted();
  if (path.startsWith("/admin")) return null;

  const close = () => {
    setWanted(false);
    if (location.hash === "#feedback") history.replaceState(null, "", location.pathname + location.search);
  };

  // no floating button any more (the AI Tutor's sits there); the form opens from "#feedback" links, e.g. the footer
  return open ? <FeedbackDialog path={path} onClose={close} /> : null;
}

function FeedbackDialog({ path, onClose }: { path: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  const quietClose = useRef(false); // a close made by the cleanup below, not by the person
  const { user, ready, configured } = useAuth();
  const [kind, setKind] = useState<Kind>("idea");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"edit" | "sending" | "sent">("edit");
  const [error, setError] = useState("");

  // open as a modal; layout-effect cleanup also closes it if Next hides this page after navigation
  useLayoutEffect(() => {
    const d = ref.current, root = document.documentElement;
    if (!d) return;
    if (!d.open) d.showModal();
    root.dataset.modal = "open";
    // runs when Next hides this page after navigation, and when React re-runs effects in development:
    // close without treating it as the person closing the form (the next setup reopens it)
    return () => { delete root.dataset.modal; if (d.open) { quietClose.current = true; d.close(); } };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (text.length < 3) { setError("Please write a little more."); return; }
    const sb = getSupabase();
    if (!sb || !user) return;
    setState("sending"); setError("");
    // no .select() after insert: learners can add feedback but not read it back
    const { error: err } = await sb.from("feedback").insert({ kind, rating, message: text.slice(0, 2000), page: path.slice(0, 200) });
    if (err) {
      setState("edit");
      setError(err.code === "23514" && /today/i.test(err.message) ? "You’ve sent a lot of feedback today. Thank you! Please try again tomorrow."
        : err.code === "42P01" || err.code === "PGRST205" ? "Feedback isn’t switched on yet. Please try again later."
        : "Couldn’t send it. Check your connection and try again.");
      return;
    }
    setState("sent");
  };

  const hint = KINDS.find((k) => k.v === kind)!.hint;

  return (
    <dialog ref={ref} aria-labelledby="fb-title"
      onClose={() => { if (quietClose.current) { quietClose.current = false; return; } onClose(); }}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) e.currentTarget.close(); }}
      className="m-auto w-[min(520px,calc(100vw-24px))] max-w-none bg-transparent p-0 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="grid max-h-[calc(100svh-24px)] overflow-y-auto rounded-[20px] border border-line bg-surface shadow-[var(--shadow)]">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="grid flex-1 gap-0.5">
            <h2 id="fb-title" className="m-0 font-display text-[1.2rem] font-bold">Help improve Track My Roadmap</h2>
            <p className="m-0 text-[.88rem] text-muted">Ideas, problems, missing topics: every message is read.</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close feedback" className="grid size-9 flex-none place-items-center rounded-lg text-muted hover:bg-sunk hover:text-ink">
            <Close size={18} />
          </button>
        </header>

        {state === "sent" ? (
          <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-done-soft text-[1.6rem]" aria-hidden="true">🙏</span>
            <h3 className="m-0 text-[1.1rem] font-bold">Thank you!</h3>
            <p className="m-0 max-w-[36ch] text-muted">Your feedback was sent. It really helps decide what to build and improve next.</p>
            <button type="button" className="btn primary mt-2" onClick={() => ref.current?.close()} autoFocus>Close</button>
          </div>
        ) : configured && ready && !user ? (
          <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
            <p className="m-0 max-w-[38ch] text-muted">Sign in to send feedback, so we can follow up if something needs fixing. You’ll come straight back here.</p>
            <SignInButton primary label="Continue with Google" next={path + "#feedback"} />
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-5 px-5 py-5">
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-2 text-[.88rem] font-semibold">How useful is it so far? <span className="font-normal text-muted">(optional)</span></legend>
              <div className="flex gap-2">
                {RATINGS.map((r) => (
                  <label key={r.v} title={r.label}
                    className="grid size-12 cursor-pointer place-items-center rounded-xl border border-line bg-bg/60 text-[1.5rem] transition has-checked:border-route has-checked:bg-route-soft has-focus-visible:outline-2 has-focus-visible:outline-route hover:border-muted">
                    <input type="radio" name="fb-rating" className="vh" checked={rating === r.v} onChange={() => setRating(r.v)} onClick={() => { if (rating === r.v) setRating(null); }} />
                    <span aria-hidden="true">{r.face}</span><span className="vh">{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-2 text-[.88rem] font-semibold">What is it about?</legend>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <label key={k.v} className="cursor-pointer rounded-full border border-line bg-bg/60 px-3.5 py-2 text-[.88rem] font-semibold text-muted transition has-checked:border-route has-checked:bg-route-soft has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-route hover:border-muted">
                    <input type="radio" name="fb-kind" className="vh" checked={kind === k.v} onChange={() => setKind(k.v)} />
                    {k.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1.5 text-[.88rem] font-semibold">
              <span className="flex justify-between">Your message <span className="font-normal text-muted">{2000 - message.length}</span></span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5} required placeholder={hint}
                className="w-full resize-y rounded-xl border border-line bg-bg px-3 py-2.5 text-[.95rem] font-normal text-ink outline-none focus:border-route focus:shadow-[0_0_0_3px_var(--route-soft)]" />
            </label>

            <p className="m-0 text-[.8rem] text-muted">Sent with your name and the page you’re on (<span className="font-mono">{path}</span>).</p>
            {error && <p role="alert" className="m-0 text-[.88rem] text-danger">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" className="btn ghost" onClick={() => ref.current?.close()}>Cancel</button>
              <button type="submit" className="btn primary" disabled={state === "sending" || !message.trim()}>{state === "sending" ? "Sending…" : "Send feedback"}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
