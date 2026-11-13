"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { Google } from "@/components/icons";
import { detectInApp, type InApp } from "@/lib/inapp";

/**
 * "Continue with Google". Inside apps like Messenger, Google refuses to sign in, so the
 * button instead explains how to open the page in Chrome or Safari.
 */
const STYLES = {
  /** outlined, with the Google logo */
  default: "min-h-10 gap-2.5 rounded-[11px] border border-line bg-bg px-3.5 text-[.95rem] hover:border-route",
  /** big blue call to action */
  primary: "min-h-12 gap-2.5 rounded-[12px] bg-route px-5 text-base text-route-ink hover:brightness-110",
  /** outlined pill with the coloured Google logo (header) */
  outline: "min-h-11 gap-2.5 rounded-full border border-line bg-bg/60 px-4 text-[.95rem] text-ink hover:border-muted",
  /** compact blue button for the header */
  nav: "min-h-10 gap-2 rounded-[11px] bg-route pr-3.5 pl-1.5 text-[.95rem] text-route-ink hover:brightness-110 sm:pr-4",
};

export function SignInButton({ className = "", label = "Sign in", wideLabel, next, primary = false, variant }: {
  className?: string;
  label?: string;
  /** longer label shown from small-tablet width up */
  wideLabel?: string;
  /** where to land after signing in (default: this page) */
  next?: string;
  /** shorthand for variant="primary" */
  primary?: boolean;
  variant?: keyof typeof STYLES;
}) {
  const v = variant ?? (primary ? "primary" : "default");
  const { signIn, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<InApp | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!help) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setHelp(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [help]);

  if (!configured) return null;

  async function start(e: React.MouseEvent) {
    e.stopPropagation();
    const env = detectInApp();
    if (env.inApp) { setHelp(env); return; }
    setBusy(true);
    try { await signIn(next); } catch { setBusy(false); }
  }

  async function copy() {
    if (!help) return;
    try { await navigator.clipboard.writeText(help.pageUrl); setCopied(true); }
    catch { window.prompt("Copy this link:", help.pageUrl); }
  }

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={start} disabled={busy}
        className={"inline-flex items-center justify-center font-semibold whitespace-nowrap disabled:cursor-progress disabled:opacity-60 " + STYLES[v] + " " + className}>
        {v === "primary" && <span className="grid size-6 place-items-center rounded-full bg-white"><Google size={15} /></span>}
        {v === "nav" && <span className="grid size-7 place-items-center rounded-[8px] bg-white"><Google size={16} /></span>}
        {(v === "default" || v === "outline") && <Google />}
        {busy ? <span>Opening Google…</span> : wideLabel
          ? <><span className="sm:hidden">{label}</span><span className="hidden sm:inline">{wideLabel}</span></>
          : <span>{label}</span>}
      </button>
      {help && (
        <div role="dialog" aria-label="Open in your browser"
          className="absolute right-0 top-[calc(100%+10px)] z-40 grid w-[min(330px,calc(100vw-32px))] gap-2.5 rounded-2xl border border-[rgba(242,164,98,.45)] bg-surface p-4 shadow-[var(--shadow)]">
          <b className="text-warm">Open in your browser to sign in</b>
          <p className="m-0 text-[.92rem]">
            Google doesn’t allow sign-in inside apps like Messenger, Facebook or LinkedIn.{" "}
            {help.android ? "Tap Open in Chrome, or use the ⋮ menu → Open in browser." : "Tap Open in Safari, or use the ⋯ menu → Open in browser."}
          </p>
          <div className="flex flex-wrap gap-2">
            {help.android && <a className="btn flex-1" href={help.chromeUrl}>Open in Chrome</a>}
            {help.ios && <a className="btn flex-1" href={help.safariUrl}>Open in Safari</a>}
            <button type="button" className="btn flex-1" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
