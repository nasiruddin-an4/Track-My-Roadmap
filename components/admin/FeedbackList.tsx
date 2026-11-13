"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import type { FeedbackItem, FeedbackKind, FeedbackStatus } from "@/lib/adminFeedback";
import { getSupabase } from "@/lib/supabase/client";

const KIND: Record<FeedbackKind, string> = { idea: "💡 Idea", bug: "🐞 Something broke", content: "📚 Roadmap or topic", other: "💬 Other" };
const FACE = ["", "😞", "🙁", "😐", "🙂", "😍"];
const RATING = ["", "Not useful", "A little useful", "Okay", "Useful", "Very useful"];
const DAY = 864e5;

function ago(ms: number, now: number) {
  const m = Math.floor((now - ms) / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`;
  const d = Math.floor((now - ms) / DAY);
  return d < 30 ? `${d}d ago` : new Date(ms).toISOString().slice(0, 10);
}

export function FeedbackList({ initial, now, named }: { initial: FeedbackItem[]; now: number; named: boolean }) {
  const [items, setItems] = useState(initial);
  const [status, setStatus] = useState<FeedbackStatus | "all">("new");
  const [kind, setKind] = useState<FeedbackKind | "all">("all");
  const toast = useToast();
  const router = useRouter(); // refreshes the sidebar's "new" count

  const counts = useMemo(() => ({
    new: items.filter((i) => i.status === "new").length,
    read: items.filter((i) => i.status === "read").length,
    done: items.filter((i) => i.status === "done").length,
    all: items.length,
  }), [items]);
  const rated = items.filter((i) => i.rating);
  const avg = rated.length ? rated.reduce((a, i) => a + (i.rating ?? 0), 0) / rated.length : null;
  const list = items.filter((i) => (status === "all" || i.status === status) && (kind === "all" || i.kind === kind));

  const setItemStatus = async (id: string, s: FeedbackStatus) => {
    const sb = getSupabase();
    if (!sb) return;
    const before = items;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status: s } : x)));
    const { error } = await sb.from("feedback").update({ status: s }).eq("id", id);
    if (error) { setItems(before); toast("Couldn’t update: " + error.message); return; }
    router.refresh();
  };
  const remove = async (id: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("feedback").delete().eq("id", id);
    if (error) { toast("Couldn’t delete: " + error.message); return; }
    setItems((xs) => xs.filter((x) => x.id !== id));
    toast("Deleted");
    router.refresh();
  };

  return (
    <div className="grid gap-5">
      <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="New" value={counts.new} />
        <Tile label="All messages" value={counts.all} />
        <Tile label="Average rating" value={avg ? `${avg.toFixed(1)} ${FACE[Math.round(avg)]}` : "—"} note={`${rated.length} rated`} />
        <Tile label="Problems reported" value={items.filter((i) => i.kind === "bug").length} />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Seg value={status} onChange={setStatus} options={[["new", `New ${counts.new}`], ["read", `Read ${counts.read}`], ["done", `Done ${counts.done}`], ["all", `All ${counts.all}`]]} label="Status" />
        <Seg value={kind} onChange={setKind} options={[["all", "All kinds"], ["idea", "💡"], ["bug", "🐞"], ["content", "📚"], ["other", "💬"]]} label="Kind" />
      </div>
      {!named && items.length > 0 && <p className="m-0 text-[.85rem] text-warm">Names aren’t shown: add SUPABASE_SECRET_KEY to see who sent each message.</p>}

      {list.length ? (
        <ul className="m-0 grid list-none gap-3 p-0">
          {list.map((f) => (
            <li key={f.id} className={"grid gap-3 rounded-2xl border bg-surface p-4 sm:p-5 " + (f.status === "new" ? "border-route/60" : "border-line")}>
              <div className="flex flex-wrap items-center gap-2 text-[.82rem]">
                <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold">{KIND[f.kind]}</span>
                {f.rating && <span className="rounded-full bg-sunk px-2.5 py-1" title={RATING[f.rating]}>{FACE[f.rating]} {RATING[f.rating]}</span>}
                {f.status === "new" && <span className="rounded-full bg-route-soft px-2.5 py-1 font-semibold text-route">New</span>}
                <span className="ml-auto text-muted" title={new Date(f.createdAt).toISOString()}>{ago(f.createdAt, now)}</span>
              </div>
              <p className="m-0 text-[.98rem] leading-relaxed whitespace-pre-wrap">{f.message}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[.84rem]">
                {f.user && (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 flex-none place-items-center overflow-hidden rounded-full bg-route-soft text-[.72rem] font-bold text-route">
                      {f.user.avatar
                        // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
                        ? <img src={f.user.avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                        : f.user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <b className="truncate">{f.user.name}</b>
                    {f.user.email && <a href={`mailto:${f.user.email}`} className="truncate text-route hover:underline">{f.user.email}</a>}
                  </span>
                )}
                {f.page && <a href={f.page} target="_blank" rel="noopener" className="font-mono text-[.78rem] text-muted hover:text-ink">{f.page} ↗</a>}
                <span className="ml-auto flex gap-1">
                  {f.status !== "read" && <Action onClick={() => setItemStatus(f.id, "read")}>Mark read</Action>}
                  {f.status !== "done" && <Action onClick={() => setItemStatus(f.id, "done")}>Done</Action>}
                  {f.status !== "new" && <Action onClick={() => setItemStatus(f.id, "new")}>Mark new</Action>}
                  <Remove onRemove={() => remove(f.id)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {items.length ? "Nothing here with these filters." : "No feedback yet. It will show up here as soon as someone sends some."}
        </p>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl border border-line bg-surface p-4">
      <dt className="order-2 text-[.82rem] text-muted">{label}</dt>
      <dd className="order-1 m-0 font-display text-[1.6rem] leading-none font-bold tabular-nums">{value}</dd>
      {note && <span className="order-3 font-mono text-[.74rem] text-muted">{note}</span>}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[11px] border border-line bg-surface p-1">
      {options.map(([v, l]) => (
        <label key={v} className="cursor-pointer rounded-lg px-3 py-1.5 text-[.86rem] font-semibold text-muted has-checked:bg-sunk has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-route">
          <input type="radio" name={"seg-" + label} className="vh" checked={value === v} onChange={() => onChange(v)} />
          {l}
        </label>
      ))}
    </div>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="rounded-lg px-2.5 py-1 text-[.8rem] font-semibold text-muted hover:bg-sunk hover:text-ink">{children}</button>;
}

function Remove({ onRemove }: { onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; } onRemove(); }}
      className={"rounded-lg px-2.5 py-1 text-[.8rem] font-semibold hover:bg-danger/10 " + (armed ? "text-danger" : "text-muted hover:text-danger")}>
      {armed ? "Click again to delete" : "Delete"}
    </button>
  );
}
