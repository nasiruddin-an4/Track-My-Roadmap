"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountDataProvider, useAccount, type CatalogEntry } from "@/components/account/AccountData";
import { useAuth } from "@/components/auth";
import { Logo } from "@/components/icons";

/* The signed-in area: a sidebar (a scrolling tab row on phones) and the section on the right. */

export const ACCOUNT_NAV = [
  { href: "/account", label: "Activity", icon: <path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /> },
  { href: "/account/profile", label: "Profile", icon: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></> },
  { href: "/account/friends", label: "Friends", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" /></> },
  { href: "/account/roadmaps", label: "Roadmaps", icon: <path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11V20" /> },
  { href: "/account/card", label: "Road Card", icon: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16a3 3 0 0 1 6 0M14 10h4.5M14 13.5h3" /></> },
  { href: "/account/certificates", label: "Certificates", icon: <><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" /></> },
  { href: "/cv", label: "CV Builder", icon: <><path d="M6 2.5h8.5L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z" /><path d="M14 2.5V7h5M8.5 12h7M8.5 15.5h7M8.5 8.5h3" /></> },
] as const;

export function NavIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function AccountShell({ catalog, children }: { catalog: CatalogEntry[]; children: React.ReactNode }) {
  const { ready, user, configured } = useAuth();
  const path = usePathname();

  // While the sign-in check runs, the layout and page still render (each page shows its own skeleton).
  if (configured && ready && !user) {
    return (
      <div className="wrap grid place-items-center py-16 sm:py-24">
        <div className="grid w-full max-w-[420px] justify-items-center gap-4 rounded-[22px] border border-line bg-surface p-8 text-center">
          <Logo size={44} className="rounded-[11px]" />
          <h1 className="m-0 font-display text-[1.7rem] font-bold tracking-[-.02em]">Log in to see your account</h1>
          <p className="m-0 text-muted">Your activity, roadmaps and certificates live here once you’re signed in.</p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Link href={`/login?next=${encodeURIComponent(path)}`} className="btn primary flex-1">Log in</Link>
            <Link href={`/signup?next=${encodeURIComponent(path)}`} className="btn flex-1">Sign up</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AccountDataProvider catalog={catalog}>
      <div className="wrap grid grid-cols-[minmax(0,1fr)] gap-6 py-6 md:grid-cols-[230px_minmax(0,1fr)] md:gap-10 md:py-10">
        <Sidebar path={path} />
        <main id="account-main" className="min-w-0">{children}</main>
      </div>
    </AccountDataProvider>
  );
}

function Sidebar({ path }: { path: string }) {
  const { profile, completed, status } = useAccount();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const isOn = (href: string) => (href === "/account" ? path === href : path.startsWith(href));

  return (
    <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 md:sticky md:top-[calc(var(--top)+24px)] md:self-start">
      <Link href="/account/profile" className="hidden items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-muted md:flex">
        {status === "loading" && !profile.email ? (
          <><span className="size-10 shrink-0 animate-pulse rounded-full bg-sunk" /><span className="h-4 flex-1 animate-pulse rounded bg-sunk" /></>
        ) : (
          <>
            <Avatar profile={profile} size={40} />
            <span className="grid min-w-0">
              <b className="truncate text-[.95rem]">{profile.name}</b>
              <span className="truncate text-[.8rem] text-muted">{profile.email}</span>
            </span>
          </>
        )}
      </Link>

      <nav aria-label="Account" className="min-w-0">
        <ul className="-mx-4 m-0 flex list-none gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:overflow-visible md:p-0 [&::-webkit-scrollbar]:hidden">
          {ACCOUNT_NAV.map((n) => {
            const on = isOn(n.href);
            return (
              <li key={n.href} className="shrink-0">
                <Link href={n.href} aria-current={on ? "page" : undefined}
                  className={"relative flex h-10 items-center gap-3 rounded-xl px-3 text-[.95rem] font-semibold whitespace-nowrap transition-colors md:h-11 " +
                    (on ? "bg-surface text-ink ring-1 ring-line md:ring-0" : "text-muted hover:bg-surface/60 hover:text-ink")}>
                  {on && <span className="absolute top-2 bottom-2 left-0 hidden w-[3px] rounded-full bg-route md:block" />}
                  <NavIcon className={on ? "text-route" : ""}>{n.icon}</NavIcon>
                  {n.label}
                  {n.href === "/account/certificates" && completed.length > 0 && (
                    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-done-soft px-1.5 font-mono text-[.7rem] text-done">{completed.length}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <button type="button" disabled={busy} onClick={() => { setBusy(true); signOut(); }}
        className="hidden h-10 items-center gap-3 rounded-xl px-3 text-left text-[.92rem] font-semibold text-muted transition-colors hover:bg-surface/60 hover:text-danger disabled:opacity-60 md:flex">
        <NavIcon><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></NavIcon>
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </aside>
  );
}

export function Avatar({ profile, size = 40, className = "" }: { profile: { avatar?: string; initials: string }; size?: number; className?: string }) {
  return (
    <span className={"grid shrink-0 place-items-center overflow-hidden rounded-full bg-route-soft font-display font-bold text-route " + className}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {profile.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={profile.avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        : profile.initials}
    </span>
  );
}
