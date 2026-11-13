"use client";

/*
 * The admin dashboard frame: a sidebar (dashboard link, every roadmap with its coverage, account),
 * a top bar (breadcrumb, view site) and the page. Replaces the site header and footer on /admin.
 * On phones the sidebar slides in from the left.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, NavIcon } from "@/components/account/AccountShell";
import { useAuth } from "@/components/auth";
import { Close, Logo, Search } from "@/components/icons";
import type { RoadmapSummary } from "@/lib/adminData";
import { profileOf } from "@/lib/profile";

export function AdminShell({ roadmaps, children }: { roadmaps: RoadmapSummary[]; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const slug = /^\/admin\/([^/]+)/.exec(path)?.[1];
  const current = roadmaps.find((r) => r.slug === slug);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  return (
    <div className="admin-shell min-h-svh bg-bg lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* The dashboard replaces the site header. Next keeps visited pages in the document (hidden) after you
          leave, so this rule is switched off when this page is hidden, or the header would stay gone. */}
      <style ref={(el) => {
        if (el) el.media = "all";
        return () => { if (el) el.media = "not all"; };
      }}>{".site-top{display:none}"}</style>
      {open && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <Sidebar roadmaps={roadmaps} path={path} open={open} onNavigate={() => setOpen(false)} />

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-line text-muted hover:text-ink lg:hidden">
            <NavIcon><path d="M4 7h16M4 12h16M4 17h16" /></NavIcon>
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[.92rem]">
            <Link href="/admin" className={current ? "text-muted hover:text-ink" : "font-semibold"}>Dashboard</Link>
            {current && (
              <>
                <span aria-hidden="true" className="text-muted">/</span>
                <span className="truncate font-semibold">{current.title}</span>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {current && (
              <Link href={`/roadmaps/${current.slug}/track`} target="_blank"
                className="hidden h-9 items-center gap-2 rounded-lg border border-line px-3 text-[.85rem] font-semibold text-muted hover:border-muted hover:text-ink sm:inline-flex">
                Preview as learner <span aria-hidden="true">↗</span>
              </Link>
            )}
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-[.85rem] font-semibold text-ink ring-1 ring-line hover:ring-muted">
              View site <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ roadmaps, path, open, onNavigate }: { roadmaps: RoadmapSummary[]; path: string; open: boolean; onNavigate: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? roadmaps.filter((r) => r.title.toLowerCase().includes(s)) : roadmaps;
  }, [q, roadmaps]);

  return (
    <aside aria-label="Admin"
      className={"fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] flex-col border-r border-line bg-band transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:max-w-none lg:translate-x-0 " +
        (open ? "translate-x-0 shadow-[var(--shadow)]" : "-translate-x-full max-lg:invisible") /* closed on phones: out of the tab order too */}>
      <div className="flex h-16 flex-none items-center gap-2.5 border-b border-line px-5">
        <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
          <Logo size={32} className="rounded-[8px]" />
          <span className="grid leading-tight">
            <b className="font-display text-[.98rem]">Track My Roadmap</b>
            <span className="font-mono text-[.66rem] tracking-[.12em] text-highlight uppercase">Admin</span>
          </span>
        </Link>
        <button type="button" aria-label="Close menu" onClick={onNavigate} className="ml-auto grid size-9 place-items-center rounded-lg text-muted hover:text-ink lg:hidden"><Close /></button>
      </div>

      <nav aria-label="Admin sections" className="flex-none p-3">
        <SideLink href="/admin" on={path === "/admin"} onClick={onNavigate}
          icon={<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>}>
          Dashboard
        </SideLink>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col border-t border-line">
        <div className="flex-none px-4 pt-4 pb-2">
          <div className="eyebrow mb-2 px-1">Roadmaps · {roadmaps.length}</div>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 text-muted focus-within:border-route">
            <Search size={15} />
            <span className="vh">Find a roadmap</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a roadmap" autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[.88rem] text-ink outline-none [&::-webkit-search-cancel-button]:hidden" />
          </label>
        </div>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-3 pb-3">
          {list.map((r) => {
            const on = path === `/admin/${r.slug}`;
            const full = r.total > 0 && r.topics === r.total;
            return (
              <li key={r.slug}>
                <Link href={`/admin/${r.slug}`} onClick={onNavigate} aria-current={on ? "page" : undefined}
                  className={"flex items-center gap-2 rounded-lg px-2.5 py-2 text-[.88rem] transition-colors " + (on ? "bg-route-soft font-semibold text-ink" : "text-muted hover:bg-sunk/60 hover:text-ink")}>
                  <span aria-hidden="true" className={"size-1.5 flex-none rounded-full " + (full ? "bg-done" : r.topics ? "bg-warm" : "bg-line")} />
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <span className="font-mono text-[.72rem] text-muted">{r.topics}/{r.total}</span>
                </Link>
              </li>
            );
          })}
          {!list.length && <li className="px-2.5 py-3 text-[.85rem] text-muted">No roadmap matches.</li>}
        </ul>
      </div>

      <UserCard />
    </aside>
  );
}

function SideLink({ href, on, onClick, icon, children }: { href: string; on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} aria-current={on ? "page" : undefined}
      className={"flex h-10 items-center gap-3 rounded-xl px-3 text-[.94rem] font-semibold transition-colors " + (on ? "bg-sunk text-ink" : "text-muted hover:bg-sunk/60 hover:text-ink")}>
      <NavIcon className={on ? "text-route" : ""}>{icon}</NavIcon>
      {children}
    </Link>
  );
}

function UserCard() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const profile = profileOf(user);
  return (
    <div className="flex flex-none items-center gap-3 border-t border-line p-4">
      <Avatar profile={profile} size={36} />
      <span className="grid min-w-0 flex-1 leading-tight">
        <b className="truncate text-[.9rem]">{profile.name}</b>
        <span className="truncate text-[.78rem] text-muted">{profile.email}</span>
      </span>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); signOut(); }} aria-label="Sign out" title="Sign out"
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50">
        <NavIcon><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></NavIcon>
      </button>
    </div>
  );
}
