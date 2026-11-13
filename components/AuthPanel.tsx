"use client";

import type { Provider } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { Google, Logo } from "@/components/icons";
import { detectInApp, type InApp } from "@/lib/inapp";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/client";
import { emitLocalChange, useLocalItem } from "@/lib/useLocal";

/*
 * The sign-up / log-in page. Both are the same "Continue with …" buttons (an OAuth account is created on
 * first sign-in); only the wording differs. The buttons shown are the providers switched on in Supabase,
 * so enabling GitHub or LinkedIn there makes its button appear here without a code change.
 */

type Option = { id: Provider; supabaseKey: string; label: string; icon: React.ReactNode };

const OPTIONS: Option[] = [
  { id: "google", supabaseKey: "google", label: "Google", icon: <Google size={20} /> },
  { id: "apple", supabaseKey: "apple", label: "Apple", icon: <AppleIcon /> },
  { id: "github", supabaseKey: "github", label: "GitHub", icon: <GitHubIcon /> },
  { id: "linkedin_oidc", supabaseKey: "linkedin_oidc", label: "LinkedIn", icon: <LinkedInIcon /> },
];
const LAST_KEY = "tmr-last-provider";

const COPY = {
  signup: {
    title: "Sign up",
    lead: "Create a free account to save your roadmap and habit progress and pick it up on any device.",
    switchText: "Already have an account?", switchLabel: "Log in", switchHref: "/login",
  },
  login: {
    title: "Welcome back",
    lead: "Log in to pick up your roadmaps and habits where you left off.",
    switchText: "New to Track My Roadmap?", switchLabel: "Create an account", switchHref: "/signup",
  },
};

/** Reads ?next= (where to land afterwards, same-site paths only) and ?error=1 from the URL. */
export function AuthPanelFromUrl({ mode }: { mode: "signup" | "login" }) {
  const sp = useSearchParams();
  const raw = sp.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <AuthPanel mode={mode} next={next} error={sp.get("error") === "1"} />;
}

export function AuthPanel({ mode, next, error }: { mode: "signup" | "login"; next: string; error?: boolean }) {
  const { ready, user, configured, signIn } = useAuth();
  const router = useRouter();
  const [enabled, setEnabled] = useState<Provider[] | null>(null);
  const last = useLocalItem(LAST_KEY);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(!!error);
  const [inApp, setInApp] = useState<InApp | null>(null);
  const [copied, setCopied] = useState(false);
  const c = COPY[mode];

  // Already signed in: nothing to do here.
  useEffect(() => { if (ready && user) router.replace(next); }, [ready, user, next, router]);

  // Which providers are switched on in Supabase (public settings endpoint); fall back to Google alone.
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return; // not configured: the panel says so instead
    let live = true;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s: { external?: Record<string, boolean> }) => {
        const on = OPTIONS.filter((o) => s.external?.[o.supabaseKey]).map((o) => o.id);
        if (live) setEnabled(on.length ? on : ["google"]);
      })
      .catch(() => { if (live) setEnabled(["google"]); });
    return () => { live = false; };
  }, []);

  async function go(p: Provider) {
    setFailed(false);
    // Google refuses sign-in inside app browsers (Messenger, Instagram…); explain instead of failing.
    if (p === "google") {
      const env = detectInApp();
      if (env.inApp) { setInApp(env); return; }
    }
    setBusy(p);
    try { localStorage.setItem(LAST_KEY, p); emitLocalChange(); } catch {}
    try { await signIn(next, p); } catch { setBusy(null); setFailed(true); }
  }

  async function copy() {
    if (!inApp) return;
    try { await navigator.clipboard.writeText(inApp.pageUrl); setCopied(true); }
    catch { window.prompt("Copy this link:", inApp.pageUrl); }
  }

  const shown = enabled ? OPTIONS.filter((o) => enabled.includes(o.id)) : null;

  return (
    <div className="relative isolate grid min-h-[calc(100svh-var(--top))] overflow-hidden place-items-center px-4 py-12 sm:py-16">
      <span className="pointer-events-none absolute top-[8%] left-1/2 -z-10 size-[420px] -translate-x-1/2 rounded-full bg-route/15 blur-[110px]" aria-hidden="true" />

      <section aria-labelledby="authH" className="grid w-full max-w-[440px] gap-7">
        <header className="grid justify-items-center gap-3 text-center">
          <Logo size={48} className="rounded-[12px]" />
          <h1 id="authH" className="m-0 font-display text-[clamp(2.2rem,6vw,2.9rem)] leading-[1.05] font-bold tracking-[-.03em]">{c.title}</h1>
          <p className="m-0 max-w-[38ch] text-[1.02rem] text-muted">{c.lead}</p>
        </header>

        <div className="grid gap-4 rounded-[22px] border border-line bg-surface/70 p-5 shadow-[var(--shadow)] backdrop-blur sm:p-6">
          {!configured ? (
            <p className="m-0 text-center text-muted">Accounts aren’t set up on this site yet. Your progress is saved on this device.</p>
          ) : (
            <>
              {failed && (
                <p role="alert" className="m-0 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[.92rem] text-danger">
                  That didn’t work. Please try again, or pick another option.
                </p>
              )}

              <ul className="m-0 grid list-none gap-3 p-0" aria-busy={!shown}>
                {shown
                  ? shown.map((o) => (
                    <li key={o.id} className="relative">
                      <button type="button" onClick={() => go(o.id)} disabled={!!busy}
                        className="flex h-[52px] w-full items-center justify-center gap-3 rounded-[14px] border border-line bg-bg px-4 text-[1rem] font-semibold text-ink transition-colors hover:border-route hover:bg-sunk/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route disabled:cursor-progress disabled:opacity-60">
                        <span className="grid size-6 place-items-center">{o.icon}</span>
                        {busy === o.id ? `Opening ${o.label}…` : `Continue with ${o.label}`}
                      </button>
                      {last === o.id && (
                        <span className="pointer-events-none absolute -top-2.5 right-3 rounded-full bg-highlight px-2.5 py-0.5 text-[.72rem] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,.35)]">
                          Last used
                        </span>
                      )}
                    </li>
                  ))
                  : [0, 1].map((i) => <li key={i} className="h-[52px] animate-pulse rounded-[14px] bg-sunk" aria-hidden="true" />)}
              </ul>

              {inApp && (
                <div role="dialog" aria-label="Open in your browser" className="grid gap-2.5 rounded-2xl border border-warm/45 bg-bg p-4">
                  <b className="text-warm">Open in your browser to continue</b>
                  <p className="m-0 text-[.92rem]">
                    Google doesn’t allow sign-in inside apps like Messenger, Facebook or LinkedIn.{" "}
                    {inApp.android ? "Tap Open in Chrome, or use the ⋮ menu → Open in browser." : "Tap Open in Safari, or use the ⋯ menu → Open in browser."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inApp.android && <a className="btn flex-1" href={inApp.chromeUrl}>Open in Chrome</a>}
                    {inApp.ios && <a className="btn flex-1" href={inApp.safariUrl}>Open in Safari</a>}
                    <button type="button" className="btn flex-1" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
                  </div>
                </div>
              )}

              <ul className="m-0 mt-1 grid list-none gap-2 border-t border-line/70 p-0 pt-4 text-[.9rem] text-muted">
                <Perk>No password to remember</Perk>
                <Perk>Your progress syncs across all your devices</Perk>
                <Perk>Free, no card needed</Perk>
              </ul>
            </>
          )}
        </div>

        <p className="m-0 text-center text-muted">
          {c.switchText}{" "}
          <Link href={`${c.switchHref}?next=${encodeURIComponent(next)}`} className="font-semibold text-route hover:underline">{c.switchLabel}</Link>
        </p>
        <p className="m-0 text-center text-[.82rem] leading-relaxed text-muted/80">
          We only use your account to save your progress. We never post anything or share your email.
        </p>
      </section>
    </div>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-done-soft text-done">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      {children}
    </li>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.65l.05-.04ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.75-.96 2.79 1.01.08 2.05-.52 2.68-1.27Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="#0A66C2" />
      <path fill="#fff" d="M7.1 9.4h2.5v8.1H7.1V9.4Zm1.25-4a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9Zm2.8 4h2.4v1.1h.04c.33-.63 1.15-1.3 2.37-1.3 2.54 0 3.01 1.67 3.01 3.84v4.46h-2.5v-3.95c0-.94-.02-2.15-1.31-2.15-1.31 0-1.51 1.02-1.51 2.08v4.02h-2.5V9.4Z" />
    </svg>
  );
}
