"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { profileOf } from "@/components/account/AccountData";
import { ACCOUNT_NAV, Avatar, NavIcon } from "@/components/account/AccountShell";
import { useAuth } from "@/components/auth";
import { Logo, Wordmark } from "@/components/icons";
import { escapeInAppOnce } from "@/lib/inapp";
import { useIsAdmin } from "@/lib/useIsAdmin";

/* The site has two tools: roadmaps and the habit tracker. Logo left, the two tools centred, account right. */

const NAV = [
  {
    href: "/roadmaps", label: "Roadmaps", short: "Roadmaps",
    match: (p: string) => p.startsWith("/roadmaps"),
    icon: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  },
  {
    href: "/habits", label: "Habit tracker", short: "Habits",
    match: (p: string) => p.startsWith("/habits"),
    icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4M9 15l2 2 4-4" /></>,
  },
];

export function SiteHeader() {
  const path = usePathname();
  useEffect(() => { escapeInAppOnce(); }, []);

  // no divider line; a soft shadow under the header, a little stronger once the page scrolls under it
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={"site-top sticky top-0 z-20 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-lg transition-shadow duration-300 " + (scrolled ? "shadow-[0_12px_32px_-12px_rgba(0,0,0,.7)]" : "shadow-[0_6px_24px_-10px_rgba(0,0,0,.45)]")}>
      <div className="wrap grid h-[var(--top)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[1fr_auto_1fr] md:gap-4">
        <Link href="/" aria-label="Track My Roadmap, home" className="flex items-center gap-2.5 justify-self-start font-display text-[1.08rem] font-bold tracking-[-.01em] whitespace-nowrap">
          <Logo size={36} className="rounded-[9px] sm:hidden" />
          <Wordmark height={40} className="hidden sm:block" onDark />
        </Link>

        <nav aria-label="Main" className="justify-self-center">
          <ul className="m-0 flex list-none gap-1 rounded-full bg-surface/70 p-1 ring-1 ring-white/[.06]">
            {NAV.map((n) => {
              const on = n.match(path);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={on ? "page" : undefined}
                    className={"inline-flex h-10 items-center gap-2 rounded-full px-3 text-[.95rem] min-[400px]:px-3.5 font-semibold whitespace-nowrap transition-colors sm:px-4 " +
                      (on ? "bg-sunk text-ink shadow-[0_1px_2px_rgba(0,0,0,.3)]" : "text-muted hover:text-ink")}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      className={"hidden min-[400px]:block " + (on ? "text-[#FF5A00]" : "")}>{n.icon}</svg>
                    <span className="sm:hidden">{n.short}</span>
                    <span className="hidden sm:inline">{n.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1 justify-self-end"><Account path={path} /></div>
      </div>
    </header>
  );
}

function Account({ path }: { path: string }) {
  const { ready, user, signOut, configured } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const isAdmin = useIsAdmin(user?.id);

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", click); document.removeEventListener("keydown", key); };
  }, [open]);

  if (!configured) return null;
  if (!ready) return <span className="block h-11 w-24 rounded-full bg-sunk" aria-hidden="true" />;
  if (!user) {
    return (
      // On the sign-up / log-in pages themselves the buttons would only point back at the same page.
      /^\/(login|signup)\b/.test(path) ? null : (
        <div className="flex items-center gap-1.5">
          <Link href={`/login?next=${encodeURIComponent(path)}`}
            className="hidden h-10 items-center rounded-full px-3.5 text-[.95rem] font-semibold text-muted transition-colors hover:text-ink md:inline-flex">
            Log in
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(path)}`}
            className="inline-flex h-10 items-center rounded-full bg-route px-4 text-[.95rem] font-semibold whitespace-nowrap text-route-ink transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route">
            Sign up
          </Link>
        </div>
      )
    );
  }

  const profile = profileOf(user);
  return (
    <div className="relative" ref={box}>
      <button type="button" aria-expanded={open} aria-haspopup="menu" aria-label={`Account menu for ${profile.name}`} onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-line bg-surface/60 p-1 pr-1 hover:border-muted aria-expanded:border-muted md:pr-3">
        <Avatar profile={profile} size={32} />
        <span className="hidden max-w-[12ch] truncate text-[.92rem] font-semibold md:inline">{profile.firstName}</span>
        <svg className="hidden text-muted md:block" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label="Account"
          className="absolute top-[calc(100%+10px)] right-0 z-30 grid w-[min(290px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
          <Link href="/account/profile" role="menuitem" onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-line p-4 transition-colors hover:bg-sunk/50">
            <Avatar profile={profile} size={42} />
            <span className="grid min-w-0">
              <b className="truncate">{profile.name}</b>
              <span className="truncate text-[.84rem] text-muted">{profile.email}</span>
            </span>
          </Link>
          <ul className="m-0 grid list-none gap-0.5 p-2">
            {ACCOUNT_NAV.map((n) => {
              const on = n.href === "/account" ? path === n.href : path.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} role="menuitem" onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}
                    className={"flex h-10 items-center gap-3 rounded-xl px-3 text-[.94rem] font-semibold transition-colors " +
                      (on ? "bg-sunk text-ink" : "text-muted hover:bg-sunk/60 hover:text-ink")}>
                    <NavIcon className={on ? "text-route" : ""}>{n.icon}</NavIcon>
                    {n.label}
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li>
                <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} aria-current={path.startsWith("/admin") ? "page" : undefined}
                  className={"flex h-10 items-center gap-3 rounded-xl px-3 text-[.94rem] font-semibold transition-colors " +
                    (path.startsWith("/admin") ? "bg-sunk text-ink" : "text-muted hover:bg-sunk/60 hover:text-ink")}>
                  <NavIcon className={path.startsWith("/admin") ? "text-route" : ""}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9.5 5 2.5-5 2.5v-5Z" /></NavIcon>
                  Admin · Topic videos
                </Link>
              </li>
            )}
          </ul>
          <div className="border-t border-line p-2">
            <button type="button" role="menuitem" disabled={busy} onClick={() => { setBusy(true); signOut(); }}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[.94rem] font-semibold text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-60">
              <NavIcon><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></NavIcon>
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
