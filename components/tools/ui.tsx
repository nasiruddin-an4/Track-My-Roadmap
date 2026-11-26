"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/auth";
import { Close } from "@/components/icons";
import { SignInButton } from "@/components/SignInButton";
import { formatBytes } from "@/lib/tools/files";

/* Building blocks shared by the student tools. */

/** Files a visitor can add at once without an account. Signing in (free) lifts the limit. */
export const GUEST_BATCH = 10;

export function useBatchLimit(): number {
  const { user, configured } = useAuth();
  return !configured || user ? Infinity : GUEST_BATCH;
}

/** Of the `incoming` files, those that fit beside the `have` already in the list, and how many were left out. */
export function takeUpTo<T>(have: number, incoming: T[], limit: number): { take: T[]; dropped: number } {
  const room = Math.max(0, limit - have);
  return { take: incoming.slice(0, room), dropped: Math.max(0, incoming.length - room) };
}

export function GuestLimitNote({ dropped }: { dropped: number }) {
  if (!dropped) return null;
  return (
    <div className="grid gap-3 rounded-2xl border border-[rgba(242,164,98,.45)] bg-[rgba(242,164,98,.08)] p-4 sm:flex sm:items-center sm:justify-between">
      <p className="m-0 text-[.94rem]">
        <b className="text-warm">{dropped} file{dropped === 1 ? " wasn’t" : "s weren’t"} added.</b>{" "}
        Without an account you can work on {GUEST_BATCH} files at a time. Sign in free to add as many as you like. You’ll come back to this page.
      </p>
      <SignInButton label="Sign in free" />
    </div>
  );
}

/**
 * The file picker: tap to choose, drag files onto it, or paste an image (Ctrl+V). On phones, choosing also
 * offers the camera. `accept` follows the file input's format, e.g. "image/*" or "application/pdf,.pdf".
 */
export function DropZone({ accept, multiple = false, onFiles, title, hint, compact = false, paste = false }: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  compact?: boolean;
  /** also take images pasted from the clipboard */
  paste?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  useEffect(() => {
    if (!paste) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      onFiles(multiple ? files : files.slice(0, 1));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [paste, multiple, onFiles]);

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
      className={"group grid cursor-pointer place-items-center rounded-[18px] border-2 border-dashed text-center transition-colors focus-within:border-route "
        + (compact ? "min-h-20 p-4 " : "min-h-48 p-6 ")
        + (drag ? "border-highlight bg-[rgba(255,90,0,.08)]" : "border-line bg-bg/40 hover:border-muted")}>
      <input ref={input} type="file" className="sr-only" accept={accept} multiple={multiple}
        onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
      <span className={"grid justify-items-center " + (compact ? "gap-1" : "gap-3")}>
        {!compact && (
          <span className="grid size-12 place-items-center rounded-2xl bg-route-soft text-route transition-transform group-hover:-translate-y-0.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
          </span>
        )}
        <b className={compact ? "text-[.98rem]" : "text-[1.08rem]"}>
          {title ?? (multiple ? "Choose files" : "Choose a file")}
          <span className="font-normal text-muted"> or drop {multiple ? "them" : "it"} here</span>
        </b>
        {hint && <span className="text-[.86rem] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** A row of choices, one selectable (radio buttons underneath, so keyboards and screen readers work). */
export function Segmented<T extends string | number>({ label, value, options, onChange, hideLabel = false }: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
      <legend className={hideLabel ? "vh" : "mb-2 p-0 text-[.88rem] font-semibold text-muted"}>{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label key={String(o.value)} title={o.title}
            className={"inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-[.92rem] font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-route "
              + (o.value === value ? "border-route bg-route-soft text-ink" : "border-line text-muted hover:border-muted hover:text-ink")}>
            <input type="radio" name={name} className="sr-only" checked={o.value === value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-[.95rem] font-semibold">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true"
        className="relative h-6 w-11 flex-none rounded-full bg-sunk ring-1 ring-line transition-colors peer-checked:bg-route peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-route after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-bg" />
      {children}
    </label>
  );
}

export const inputClass = "h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-[.98rem] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-route";

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 content-start gap-1.5">
      <span className="text-[.88rem] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[.82rem] text-muted">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok" | "warn"; children: React.ReactNode }) {
  const styles = {
    info: "border-line bg-bg/50 text-muted",
    error: "border-danger/40 bg-danger/10 text-ink",
    ok: "border-done/40 bg-done-soft text-ink",
    warn: "border-[rgba(242,164,98,.45)] bg-[rgba(242,164,98,.08)] text-ink",
  };
  return (
    <div role={tone === "error" ? "alert" : undefined} className={"rounded-xl border px-4 py-3 text-[.93rem] leading-relaxed " + styles[tone]}>
      {children}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={"inline-block size-4 flex-none animate-spin rounded-full border-2 border-current border-t-transparent " + className} />;
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="grid gap-2" role="status">
      <div className="flex items-center justify-between gap-3 text-[.9rem]">
        <span className="flex items-center gap-2 font-semibold"><Spinner className="text-route" />{label}</span>
        <span className="mono text-muted">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunk">
        <div className="h-full rounded-full bg-route transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A file in a list: preview, name, size, and buttons to move it or remove it. */
export function FileRow({ name, size, thumb, meta, error, index, count, onMove, onRemove, children }: {
  name: string;
  size: number;
  thumb?: string;
  meta?: React.ReactNode;
  error?: string;
  index: number;
  count: number;
  onMove?: (from: number, to: number) => void;
  onRemove?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <li className={"grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-bg/50 p-2.5 pr-3 " + (error ? "border-danger/50" : "border-line")}>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the student's own file
        <img src={thumb} alt="" className="size-14 flex-none rounded-xl bg-white object-cover" />
      ) : (
        <span className="grid size-14 flex-none place-items-center rounded-xl bg-sunk font-mono text-[.72rem] font-semibold text-muted uppercase">
          {name.split(".").pop()?.slice(0, 4) || "file"}
        </span>
      )}
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate font-semibold" title={name}>{name}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[.84rem] text-muted">
          <span>{formatBytes(size)}</span>
          {meta}
        </span>
        {error && <span className="text-[.84rem] text-danger">{error}</span>}
        {children}
      </span>
      <span className="flex items-center gap-0.5">
        {onMove && count > 1 && (
          <>
            <IconButton label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
              <path d="m6 15 6-6 6 6" />
            </IconButton>
            <IconButton label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
              <path d="m6 9 6 6 6-6" />
            </IconButton>
          </>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}
            className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-danger/10 hover:text-danger">
            <Close />
          </button>
        )}
      </span>
    </li>
  );
}

export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-sunk hover:text-ink disabled:pointer-events-none disabled:opacity-30">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    </button>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
    </svg>
  );
}

/** The finished file: what it is, how big, and the download button. */
export function ResultCard({ title, detail, onDownload, label = "Download", children }: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  onDownload: () => void;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-done/40 bg-done-soft/60 p-4 sm:flex sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-full bg-done text-bg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <span className="grid min-w-0 gap-0.5">
          <b className="truncate">{title}</b>
          {detail && <span className="text-[.88rem] text-muted">{detail}</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        <button type="button" onClick={onDownload} className="btn big w-full sm:w-auto"><DownloadIcon />{label}</button>
      </div>
    </div>
  );
}

/** "2.4 MB → 640 KB · 73% smaller" */
export function SizeChange({ before, after }: { before: number; after: number }) {
  const pct = Math.round((1 - after / before) * 100);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span>{formatBytes(before)}</span>
      <span aria-hidden="true">→</span><span className="vh">to</span>
      <b className="text-ink">{formatBytes(after)}</b>
      {pct > 0 && <span className="text-done">· {pct}% smaller</span>}
    </span>
  );
}

/** Message text from anything thrown. */
export function errorText(e: unknown, fallback = "Something went wrong. Please try again."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Object URLs for previews, revoked when the component goes away. */
export function useObjectUrls() {
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const set = urls.current;
    return () => { set.forEach((u) => URL.revokeObjectURL(u)); set.clear(); };
  }, []);
  return {
    make(blob: Blob) { const u = URL.createObjectURL(blob); urls.current.add(u); return u; },
    drop(u?: string) { if (u && urls.current.delete(u)) URL.revokeObjectURL(u); },
  };
}

export function ToolActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

let nextId = 0;
/** A stable key for a file in a list. */
export const fileId = () => `f${++nextId}`;
