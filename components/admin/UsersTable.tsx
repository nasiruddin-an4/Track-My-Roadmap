"use client";

import { useMemo, useState } from "react";
import { Close, Search } from "@/components/icons";
import type { InsightUser } from "@/lib/adminInsights";

type Sort = "active" | "newest" | "progress";
type Show = "all" | "active" | "never";

const DAY = 864e5;

/** Times are shown relative to when the server built this page (`now`), so server and browser render the same text. */
function ago(ms: number | null, now: number) {
  if (!ms) return "never";
  const d = Math.floor((now - ms) / DAY);
  if (d <= 0) {
    const h = Math.floor((now - ms) / 36e5);
    return h <= 0 ? "just now" : `${h}h ago`;
  }
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function UsersTable({ users, now }: { users: InsightUser[]; now: number }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("active");
  const [show, setShow] = useState<Show>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = users.filter((u) =>
      (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) &&
      (show === "all" || (show === "active" ? !!u.lastActive && now - u.lastActive <= 7 * DAY : !u.lastActive)));
    const by: Record<Sort, (a: InsightUser, b: InsightUser) => number> = {
      active: (a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0) || b.joined - a.joined,
      newest: (a, b) => b.joined - a.joined,
      progress: (a, b) => b.topicsDone - a.topicsDone || b.certificates - a.certificates,
    };
    return out.sort(by[sort]);
  }, [users, q, sort, show, now]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 basis-[240px] items-center gap-2 rounded-[11px] border border-line bg-surface pr-2.5 pl-3 text-muted focus-within:border-route lg:max-w-[380px]">
          <Search />
          <span className="vh">Search by name or email</span>
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} placeholder="Search by name or email" autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-[.95rem] text-ink outline-none [&::-webkit-search-cancel-button]:hidden" />
          {q && <button type="button" aria-label="Clear search" className="grid place-items-center rounded-md p-1" onClick={() => setQ("")}><Close /></button>}
        </label>
        <Choice label="Show" value={show} onChange={(v) => { setShow(v); setLimit(50); }} options={[["all", "Everyone"], ["active", "Active this week"], ["never", "Never ticked"]]} />
        <Choice label="Sort" value={sort} onChange={setSort} options={[["active", "Last active"], ["newest", "Newest"], ["progress", "Most progress"]]} />
        <span className="ml-auto font-mono text-[.8rem] text-muted">{list.length} of {users.length}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[.88rem]">
            <thead>
              <tr className="text-left">
                {["User", "Joined", "Last active", "Roadmaps", "Topics", "Certificates", ""].map((h, i) => (
                  <th key={i} scope="col" className="eyebrow border-b border-line px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((u) => {
                const isOpen = open === u.id;
                return (
                  <UserRow key={u.id} u={u} now={now} open={isOpen} onToggle={() => setOpen(isOpen ? null : u.id)} />
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <p className="m-0 p-6 text-center text-muted">{users.length ? "No one matches." : "No users yet."}</p>}
      </div>
      {list.length > limit && (
        <button type="button" className="btn justify-self-center" onClick={() => setLimit((n) => n + 50)}>Show 50 more</button>
      )}
    </div>
  );
}

function UserRow({ u, now, open, onToggle }: { u: InsightUser; now: number; open: boolean; onToggle: () => void }) {
  const detail = "u-" + u.id;
  return (
    <>
      <tr className={"border-b border-line " + (open ? "bg-sunk/40" : "hover:bg-sunk/30")}>
        <th scope="row" className="px-4 py-2.5 text-left font-normal">
          <span className="flex items-center gap-3">
            <span className="grid size-9 flex-none place-items-center overflow-hidden rounded-full bg-route-soft font-display text-[.8rem] font-bold text-route">
              {u.avatar
                // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
                ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />
                : u.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="grid min-w-0 leading-tight">
              <b className="truncate font-semibold">{u.name}</b>
              <span className="truncate text-[.8rem] text-muted">{u.email}</span>
            </span>
          </span>
        </th>
        <td className="px-4 py-2.5 whitespace-nowrap text-muted" title={new Date(u.joined).toISOString().slice(0, 10)}>{ago(u.joined, now)}</td>
        <td className="px-4 py-2.5 whitespace-nowrap">{u.lastActive ? ago(u.lastActive, now) : <span className="text-muted">never</span>}</td>
        <td className="px-4 py-2.5 font-mono">{u.roadmaps.length}</td>
        <td className="px-4 py-2.5 font-mono">{u.topicsDone}</td>
        <td className="px-4 py-2.5 font-mono">{u.certificates}</td>
        <td className="px-4 py-2.5 text-right">
          {u.roadmaps.length > 0 && (
            <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={detail}
              className="rounded-lg px-2.5 py-1 text-[.8rem] font-semibold text-route hover:bg-route-soft">
              {open ? "Hide" : "Details"}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr id={detail} className="border-b border-line bg-sunk/20">
          <td colSpan={7} className="px-4 py-3">
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
              {u.roadmaps.map((r) => (
                <li key={r.slug} className="grid gap-1.5 rounded-xl border border-line bg-surface p-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate text-[.9rem]">{r.title}</b>
                    <span className="font-mono text-[.78rem] text-muted">{r.done}/{r.total} · {r.pct}%</span>
                  </span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-sunk">
                    <i className={"block h-full rounded-full " + (r.complete ? "bg-done" : "bg-route")} style={{ width: r.pct + "%" }} />
                  </span>
                  <span className="text-[.78rem] text-muted">{r.complete ? "Completed · certificate earned" : r.current ? `Now on ${r.current}` : ""} · last {ago(r.updatedAt, now)}</span>
                </li>
              ))}
            </ul>
            {u.habits && <p className="m-0 mt-2 text-[.8rem] text-muted">Also uses the habit tracker.</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-[11px] border border-line bg-surface px-3 text-[.85rem] text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="bg-transparent font-semibold text-ink outline-none">
        {options.map(([v, l]) => <option key={v} value={v} className="bg-surface">{l}</option>)}
      </select>
    </label>
  );
}
