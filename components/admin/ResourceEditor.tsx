"use client";

/*
 * Admin editor for one roadmap: pick a phase (or search), open a topic, paste a YouTube link.
 * Writes go straight to Supabase from the browser; row level security only lets admins write.
 */
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Close, Search } from "@/components/icons";
import { ResourceLink, YouTubeMark } from "@/components/roadmap/ResourceLink";
import { useToast } from "@/components/toast";
import { RESOURCE_COLUMNS, groupByTopic, type TopicResource } from "@/lib/resources";
import { allVideoKeys, buildRoadmap, videoSlots, type Card, type Phase, type RoadmapDef, type Tag, type VideoSlot } from "@/lib/roadmap";
import { getSupabase } from "@/lib/supabase/client";
import { KIND_LABEL, parseYouTube, type ResourceKind } from "@/lib/youtube";

type Filter = "all" | "missing" | "has";
type Fields = Pick<TopicResource, "kind" | "url" | "title" | "channel" | "thumbnail" | "note">;
type Ops = {
  add: (key: string, f: Fields) => Promise<boolean>;
  patch: (id: string, f: Partial<Fields>) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  move: (key: string, id: string, dir: -1 | 1) => Promise<void>;
};

const TAG_TEXT: Partial<Record<Tag, string>> = { opt: "Optional", adv: "Advanced", cont: "Ongoing" };
const pad = (n: number) => (n < 10 ? "0" + n : String(n));

function dbError(e: { code?: string; message: string }) {
  if (e.code === "42501") return "Not allowed: this account isn’t in the admins table.";
  if (e.code === "42P01" || e.code === "PGRST205") return "The topic_resources table is missing. Run supabase/schema.sql in Supabase first.";
  if (e.code === "23514") return "YouTube links only, and keep the title under 200 and the note under 280 characters.";
  return e.message;
}

export function ResourceEditor({ def, initial }: { def: RoadmapDef; initial: TopicResource[] }) {
  const rm = useMemo(() => buildRoadmap(def), [def]);
  const toast = useToast();
  const router = useRouter(); // refreshes the sidebar's coverage counts after a change
  const moving = useRef(false);
  const [rows, setRows] = useState(initial);
  const map = useMemo(() => groupByTopic(rows), [rows]);
  const keys = useMemo(() => allVideoKeys(rm), [rm]);
  const keySet = useMemo(() => new Set(keys), [keys]);
  const orphans = rows.filter((r) => !keySet.has(r.topic_key));
  const covered = keys.filter((k) => map[k]?.length).length;

  const [phaseId, setPhaseId] = useState(rm.phases[0]?.id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  /* ---------- writes ---------- */
  const sb = getSupabase();
  const ops: Ops = {
    add: async (key, f) => {
      if (!sb) return false;
      const list = map[key] ?? [];
      const position = list.length ? Math.max(...list.map((r) => r.position)) + 1 : 0;
      const { data, error } = await sb.from("topic_resources")
        .insert({ roadmap: def.slug, topic_key: key, position, ...f })
        .select(RESOURCE_COLUMNS).single();
      if (error) { toast(dbError(error)); return false; }
      setRows((rs) => [...rs, data as TopicResource]);
      toast(`${KIND_LABEL[f.kind]} added`);
      router.refresh();
      return true;
    },
    patch: async (id, f) => {
      if (!sb) return false;
      const { data, error } = await sb.from("topic_resources").update(f).eq("id", id).select(RESOURCE_COLUMNS).single();
      if (error) { toast(dbError(error)); return false; }
      setRows((rs) => rs.map((r) => (r.id === id ? (data as TopicResource) : r)));
      return true;
    },
    remove: async (id) => {
      if (!sb) return;
      const { error } = await sb.from("topic_resources").delete().eq("id", id);
      if (error) { toast(dbError(error)); return; }
      setRows((rs) => rs.filter((r) => r.id !== id));
      toast("Removed");
      router.refresh();
    },
    move: async (key, id, dir) => {
      if (!sb || moving.current) return; // one move at a time, so positions can't interleave
      moving.current = true;
      try { await doMove(key, id, dir); } finally { moving.current = false; }
    },
  };
  async function doMove(key: string, id: string, dir: -1 | 1) {
    {
      if (!sb) return;
      const list = [...(map[key] ?? [])];
      const i = list.findIndex((r) => r.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      const changed = list.map((r, n) => ({ id: r.id, position: n })).filter((u) => map[key].find((r) => r.id === u.id)!.position !== u.position);
      const before = rows;
      setRows((rs) => rs.map((r) => { const u = changed.find((c) => c.id === r.id); return u ? { ...r, position: u.position } : r; }));
      const results = await Promise.all(changed.map((u) => sb.from("topic_resources").update({ position: u.position }).eq("id", u.id)));
      const err = results.find((r) => r.error)?.error;
      if (err) {
        toast(dbError(err));
        // some updates may have landed: show what the database actually has
        const { data } = await sb.from("topic_resources").select(RESOURCE_COLUMNS).eq("roadmap", def.slug);
        setRows(data ? (data as TopicResource[]) : before);
      }
    }
  }

  /* ---------- what to show ---------- */
  const q = query.trim().toLowerCase();
  // the slot being edited stays visible even if a change means it no longer matches the filter
  const keep = (v: VideoSlot) => filter === "all" || v.key === open || (filter === "has") === Boolean(map[v.key]?.length);
  const visibleCards = (ph: Phase) =>
    ph.cards
      .map((c) => {
        const slots = videoSlots(c);
        // a search finds a card by its title or by any topic under it
        const hit = !q || c.title.toLowerCase().includes(q) || c.rows.some((r) => r.name.toLowerCase().includes(q));
        const shown = !hit ? [] : slots[0]?.whole || !q || c.title.toLowerCase().includes(q) ? slots : slots.filter((v) => v.name.toLowerCase().includes(q));
        return { c, slots: shown.filter(keep) };
      })
      .filter((h) => h.slots.length);
  const phasesShown = q ? rm.phases : rm.phases.filter((ph) => ph.id === phaseId);
  const groups = phasesShown.map((ph) => ({ ph, cards: visibleCards(ph) })).filter((g) => g.cards.length);

  const phaseCover = (ph: Phase) => {
    const ks = Array.from(new Set(ph.cards.flatMap((c) => videoSlots(c).map((v) => v.key))));
    return { d: ks.filter((k) => map[k]?.length).length, t: ks.length };
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-1.5">
        <h1 className="m-0 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-bold tracking-[-.03em]">{def.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="block h-1.5 w-40 overflow-hidden rounded-full bg-sunk">
            <i className={"block h-full rounded-full " + (covered === keys.length ? "bg-done" : "bg-warm")} style={{ width: (keys.length ? (covered / keys.length) * 100 : 0) + "%" }} />
          </span>
          <span className="font-mono text-[.82rem] text-muted">
            {covered} of {keys.length} covered · {rows.length} {rows.length === 1 ? "link" : "links"}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 basis-[260px] items-center gap-2 rounded-[11px] border border-line bg-surface pr-2.5 pl-3 text-muted focus-within:border-route focus-within:shadow-[0_0_0_3px_var(--route-soft)] lg:max-w-[440px]">
          <Search />
          <span className="vh">Search topics in every phase</span>
          <input type="search" value={query} placeholder="Search topics in every phase" autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
            className="h-10 min-w-0 flex-1 bg-transparent text-[.95rem] text-ink outline-none [&::-webkit-search-cancel-button]:hidden" />
          {query && <button type="button" aria-label="Clear search" className="grid place-items-center rounded-md p-1" onClick={() => setQuery("")}><Close /></button>}
        </label>
        <div className="flex rounded-[11px] border border-line bg-surface p-1" role="radiogroup" aria-label="Show topics">
          {([["all", "All"], ["missing", "No video yet"], ["has", "Has videos"]] as [Filter, string][]).map(([v, l]) => (
            <label key={v} className="cursor-pointer rounded-lg px-3 py-1.5 text-[.88rem] font-semibold text-muted has-checked:bg-sunk has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-route">
              <input type="radio" name="admin-filter" value={v} checked={filter === v} onChange={() => setFilter(v)} className="vh" />
              {l}
            </label>
          ))}
        </div>
      </div>

      {!q && (
        <nav aria-label="Phases" className="-mx-4 overflow-x-auto px-4">
          <ul className="m-0 flex w-max list-none gap-2 p-0">
            {rm.phases.map((ph) => {
              const c = phaseCover(ph), on = ph.id === phaseId;
              return (
                <li key={ph.id}>
                  <button type="button" aria-current={on ? "true" : undefined} onClick={() => { setPhaseId(ph.id); setOpen(null); }}
                    className={"grid gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors " + (on ? "border-route bg-route-soft" : "border-line bg-surface hover:border-muted")}>
                    <span className="eyebrow">{ph.ongoing ? "Ongoing" : "Phase " + pad(ph.num!)}</span>
                    <span className="text-[.9rem] font-semibold whitespace-nowrap">{ph.short}</span>
                    <span className={"font-mono text-[.75rem] " + (c.d === c.t && c.t ? "text-done" : "text-muted")}>{c.d}/{c.t}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {groups.length ? groups.map((g) => (
        <section key={g.ph.id} className="grid gap-3">
          <h2 className="m-0 flex items-baseline gap-3 font-display text-[1.25rem] font-bold">
            <span className="eyebrow">{g.ph.ongoing ? "Ongoing" : "Phase " + pad(g.ph.num!)}</span>{g.ph.title}
          </h2>
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {g.cards.map(({ c, slots }) => (
              <CardBox key={c.id} card={c} slots={slots} map={map} open={open} setOpen={setOpen} ops={ops} />
            ))}
          </div>
        </section>
      )) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {q ? `Nothing matches “${query.trim()}”.` : filter === "missing" ? "Everything in this phase has a video. Nice." : "Nothing in this phase has a video yet."}
        </p>
      )}

      {!q && orphans.length > 0 && (
        <section className="grid gap-3 rounded-2xl border border-warm/40 bg-surface p-4">
          <h2 className="m-0 text-[1.05rem] font-bold">Not shown to learners ({orphans.length})</h2>
          <p className="m-0 text-[.9rem] text-muted">These are attached to a sub-topic, or to a topic that was renamed or removed. Videos now go on the card heading: add them there again, then remove them here.</p>
          <div className="grid gap-2">
            {orphans.map((r) => (
              <ResourceLink key={r.id} r={r}>
                <span className="font-mono text-[.75rem] text-muted">{r.topic_key}</span>
                <RemoveButton onRemove={() => ops.remove(r.id)} />
              </ResourceLink>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- a card: one video slot for the whole card, or one per topic ---------- */

function CardBox({ card, slots, map, open, setOpen, ops }: {
  card: Card; slots: VideoSlot[]; map: Record<string, TopicResource[]>;
  open: string | null; setOpen: (k: string | null) => void; ops: Ops;
}) {
  const whole = slots[0]?.whole;
  if (whole) {
    const v = slots[0], list = map[v.key] ?? [], isOpen = open === v.key;
    return (
      <article className={"rounded-2xl border bg-surface " + (isOpen ? "border-route/60" : "border-line")}>
        <SlotButton slot={v} count={list.length} open={isOpen} onToggle={() => setOpen(isOpen ? null : v.key)} heading />
        <ul aria-label={`Topics in ${card.title}`} className="m-0 flex list-none flex-wrap gap-1.5 px-4 pb-3 sm:px-5">
          {card.rows.map((r) => <li key={r.key} className="rounded-md bg-sunk/70 px-2 py-0.5 text-[.78rem] text-muted">{r.name}</li>)}
        </ul>
        {isOpen && <SlotPanel slot={v} list={list} ops={ops} />}
      </article>
    );
  }
  return (
    <article className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <h3 className="m-0 mb-1 px-2.5 text-[1rem] font-bold">
        {card.title}
        {card.mode === "pick" && <span className="tag pick ml-2 align-middle">Pick one</span>}
      </h3>
      <p className="m-0 mb-2 px-2.5 text-[.8rem] text-muted">{card.mode === "pick" ? "One video per choice" : "Standalone topics: one video each"}</p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {slots.map((v) => {
          const list = map[v.key] ?? [], isOpen = open === v.key;
          return (
            <li key={v.key} className={"rounded-xl " + (isOpen ? "bg-bg/50 ring-1 ring-line" : "")}>
              <SlotButton slot={v} count={list.length} open={isOpen} onToggle={() => setOpen(isOpen ? null : v.key)} />
              {isOpen && <SlotPanel slot={v} list={list} ops={ops} />}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

const panelId = (key: string) => "res-" + key.replace(/[^a-z0-9-]/gi, "_");

function SlotButton({ slot, count, open, onToggle, heading }: { slot: VideoSlot; count: number; open: boolean; onToggle: () => void; heading?: boolean }) {
  return (
    <button type="button" aria-expanded={open} aria-controls={panelId(slot.key)} onClick={onToggle}
      className={"flex w-full items-center gap-2 text-left hover:bg-sunk/50 " + (heading ? "min-h-14 rounded-t-2xl px-4 pt-3 pb-2 sm:px-5" : "min-h-11 rounded-xl px-2.5")}>
      <span className={"min-w-0 flex-1 " + (heading ? "text-[1rem] font-bold" : "text-[.94rem]")}>{slot.name}</span>
      {TAG_TEXT[slot.tag] && <span className={"tag " + slot.tag}>{TAG_TEXT[slot.tag]}</span>}
      {count
        ? <span className="inline-flex items-center gap-1.5 rounded-full bg-done-soft px-2 py-0.5 font-mono text-[.75rem] text-done"><YouTubeMark size={13} />{count}</span>
        : <span className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-[.75rem] text-muted">+ Add video</span>}
    </button>
  );
}

function SlotPanel({ slot, list, ops }: { slot: VideoSlot; list: TopicResource[]; ops: Ops }) {
  return (
    <div id={panelId(slot.key)} className="grid gap-2 px-2.5 pt-1 pb-3 sm:px-4">
      {list.map((res, i) => <ResourceItem key={res.id} r={res} first={i === 0} last={i === list.length - 1} topicKey={slot.key} ops={ops} />)}
      <AddForm topic={slot.name} existing={list} onAdd={(f) => ops.add(slot.key, f)} />
    </div>
  );
}

const small = "inline-flex h-8 items-center rounded-lg px-2.5 text-[.8rem] font-semibold text-muted hover:bg-sunk hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

function ResourceItem({ r, first, last, topicKey, ops }: { r: TopicResource; first: boolean; last: boolean; topicKey: string; ops: Ops }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <EditForm r={r} onCancel={() => setEditing(false)} onSave={async (f) => { if (await ops.patch(r.id, f)) setEditing(false); }} />;
  return (
    <ResourceLink r={r}>
      <div className="-ml-2.5 flex flex-wrap items-center">
        <button type="button" className={small} disabled={first} onClick={() => ops.move(topicKey, r.id, -1)} aria-label={`Move “${r.title}” up`}>↑ Up</button>
        <button type="button" className={small} disabled={last} onClick={() => ops.move(topicKey, r.id, 1)} aria-label={`Move “${r.title}” down`}>↓ Down</button>
        <button type="button" className={small} onClick={() => setEditing(true)}>Edit</button>
        <RemoveButton onRemove={() => ops.remove(r.id)} />
      </div>
    </ResourceLink>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className={small + (armed ? " !text-danger" : "")}
      onClick={() => { if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; } setArmed(false); onRemove(); }}>
      {armed ? "Click again to remove" : "Remove"}
    </button>
  );
}

/* ---------- forms ---------- */

const input = "h-10 w-full rounded-lg border border-line bg-bg px-3 text-[.92rem] text-ink outline-none focus:border-route focus:shadow-[0_0_0_3px_var(--route-soft)]";
const labelCls = "grid gap-1 text-[.8rem] font-semibold text-muted";

function EditForm({ r, onSave, onCancel }: { r: TopicResource; onSave: (f: Partial<Fields>) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(r.title);
  const [channel, setChannel] = useState(r.channel ?? "");
  const [note, setNote] = useState(r.note ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-2 rounded-xl border border-route/50 bg-bg/60 p-3"
      onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; setBusy(true); await onSave({ title: title.trim(), channel: channel.trim() || null, note: note.trim() || null }); setBusy(false); }}>
      <label className={labelCls}>Title<input className={input} value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} /></label>
      <label className={labelCls}>Channel<input className={input} value={channel} maxLength={120} onChange={(e) => setChannel(e.target.value)} /></label>
      <NoteField value={note} onChange={setNote} />
      <div className="flex gap-2">
        <button type="submit" className="btn primary !min-h-9" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" className="btn ghost !min-h-9" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className={labelCls}>
      <span className="flex justify-between">Why this one? <span className="font-normal">optional · {280 - value.length}</span></span>
      <textarea className={input + " h-auto min-h-16 py-2"} rows={2} maxLength={280} value={value} placeholder="e.g. Clearest 20-minute intro; watch before the docs"
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

type Info = { kind: ResourceKind; url: string; title: string; channel: string; thumbnail: string | null; warning?: string };

function AddForm({ topic, existing, onAdd }: { topic: string; existing: TopicResource[]; onAdd: (f: Fields) => Promise<boolean> }) {
  const [url, setUrl] = useState("");
  const [asPlaylist, setAsPlaylist] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // a watch link that sits inside a playlist can be saved as either
  const inList = parseYouTube(url)?.kind === "video" && parseYouTube(url, true)?.kind === "playlist";

  // each lookup gets a number; a slow answer to an older one (link changed since) is ignored
  const lookupId = useRef(0);
  const reset = () => { lookupId.current++; setUrl(""); setInfo(null); setTitle(""); setChannel(""); setNote(""); setError(""); setAsPlaylist(false); setBusy(false); };

  const lookup = async (raw: string, playlist = asPlaylist) => {
    const my = ++lookupId.current;
    setError("");
    if (!parseYouTube(raw, playlist)) { setInfo(null); if (raw.trim()) setError("Paste a YouTube video, playlist or channel link."); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/youtube-info?url=${encodeURIComponent(raw)}${playlist ? "&playlist=1" : ""}`);
      const data = await res.json();
      if (my !== lookupId.current) return;
      if (!res.ok) { setInfo(null); setError(data.error ?? "Couldn’t read that link."); return; }
      setInfo(data);
      const handle = data.kind === "channel" ? (parseYouTube(raw)?.id ?? "").replace(/^(channel|c|user)\//, "") : "";
      setTitle(data.title || handle);
      setChannel(data.channel || handle);
    } catch {
      if (my === lookupId.current) setError("Couldn’t reach the server. Try again.");
    } finally {
      if (my === lookupId.current) setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) { await lookup(url); return; }
    if (!title.trim()) { setError("Give it a title."); return; }
    if (existing.some((r) => r.url === info.url)) { setError("This link is already on this topic."); return; }
    setBusy(true);
    const ok = await onAdd({ kind: info.kind, url: info.url, title: title.trim(), channel: channel.trim() || null, thumbnail: info.thumbnail, note: note.trim() || null });
    setBusy(false);
    if (ok) reset();
  };

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border border-dashed border-line p-3">
      <label className={labelCls}>
        Add a YouTube link for “{topic}”
        <div className="flex gap-2">
          <input className={input} type="url" inputMode="url" value={url} placeholder="https://www.youtube.com/watch?v=…" autoComplete="off"
            onChange={(e) => { lookupId.current++; setBusy(false); setUrl(e.target.value); setInfo(null); setError(""); }}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); setUrl(t.trim()); setInfo(null); lookup(t); } }} />
          {!info && <button type="submit" className="btn !min-h-10 flex-none" disabled={busy || !url.trim()}>{busy ? "Looking…" : "Look up"}</button>}
        </div>
      </label>
      {inList && (
        <label className="flex items-center gap-2 text-[.85rem] text-muted">
          <input type="checkbox" checked={asPlaylist} onChange={(e) => { setAsPlaylist(e.target.checked); lookup(url, e.target.checked); }} />
          This video is in a playlist. Save the whole playlist instead.
        </label>
      )}
      {error && <p role="alert" className="m-0 text-[.85rem] text-danger">{error}</p>}
      {info && (
        <>
          {info.warning && <p className="m-0 text-[.85rem] text-warm">{info.warning}</p>}
          <ResourceLink r={{ kind: info.kind, url: info.url, title: title || "Untitled", channel: channel || null, thumbnail: info.thumbnail, note: note || null }} />
          <label className={labelCls}>Title<input className={input} value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} /></label>
          <label className={labelCls}>{info.kind === "channel" ? "Channel name" : "Channel"}<input className={input} value={channel} maxLength={120} onChange={(e) => setChannel(e.target.value)} /></label>
          <NoteField value={note} onChange={setNote} />
          <div className="flex gap-2">
            <button type="submit" className="btn primary !min-h-9" disabled={busy}>{busy ? "Saving…" : `Add ${KIND_LABEL[info.kind].toLowerCase()}`}</button>
            <button type="button" className="btn ghost !min-h-9" onClick={reset}>Cancel</button>
          </div>
        </>
      )}
    </form>
  );
}
