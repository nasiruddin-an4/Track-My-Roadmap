"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import type { PageSize } from "@/lib/cv/schema";
import { btnOrange, iconBtn, inputCls } from "./ui";

type Props = {
  id: string; pageSize: PageSize; flush: () => Promise<boolean>; onPageSize: (p: PageSize) => void; onDelete: () => void;
  /** the CV still has [X] placeholders from an AI suggestion */
  placeholders?: boolean;
  isPrimary: boolean; onPrimary: (primary: boolean) => Promise<void>;
  shareToken: string | null; onShare: (on: boolean) => Promise<void>;
  onDuplicate: () => Promise<void>;
};

const item = "flex h-10 w-full items-center rounded-lg px-3 text-left hover:bg-sunk disabled:opacity-50";

/** Download the PDF (after saving), plus a menu: Word file, open PDF, paper size, primary, copy, share link, delete. */
export function ExportMenu({ id, pageSize, flush, onPageSize, onDelete, placeholders, isPrimary, onPrimary, shareToken, onShare, onDuplicate }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const shareUrl = shareToken ? `${typeof window === "undefined" ? "" : window.location.origin}/cv/s/${shareToken}` : "";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) { setOpen(false); setArmed(false); }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const work = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } finally { setBusy(null); }
  };

  const download = async (kind: "pdf" | "docx", anyway = false) => {
    if (placeholders && !anyway) {
      toast("Your CV still has [X] placeholders to fill in.", { label: "Download anyway", run: () => void download(kind, true) });
      return;
    }
    await work(kind, async () => {
      if (!(await flush())) { toast(`Fix the form first: the ${kind === "pdf" ? "PDF" : "Word file"} is made from your saved CV.`); return; }
      // a file download, not a page: a temporary link keeps the editor open
      const a = document.createElement("a");
      a.href = `/api/cv/${id}/${kind}`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  const view = async () => {
    const w = window.open("about:blank", "_blank"); // opened now, while the click still counts, so it isn't blocked
    const ok = await flush();
    if (!ok) { w?.close(); toast("Fix the form first: the PDF is made from your saved CV."); return; }
    if (w) w.location.href = `/api/cv/${id}/pdf?inline=1`;
    setOpen(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast("Link copied"); } catch { toast("Couldn’t copy. Select the link and copy it."); }
  };

  return (
    <div className="relative flex items-center gap-2" ref={menu}>
      <button type="button" className={btnOrange} onClick={() => void download("pdf")} disabled={!!busy}>{busy === "pdf" ? "Preparing…" : "↓ Download PDF"}</button>
      <button type="button" className={iconBtn + " size-10 border border-line"} aria-haspopup="menu" aria-expanded={open} aria-label="More"
        onClick={() => { setOpen((v) => !v); setArmed(false); }}>⋯</button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-30 grid max-h-[calc(100vh-var(--top)-90px)] w-[min(20rem,calc(100vw-32px))] gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-(--shadow)">
          <button type="button" role="menuitem" className={item} onClick={() => void download("docx")} disabled={!!busy}>{busy === "docx" ? "Preparing…" : "Download Word (.docx)"}</button>
          <button type="button" role="menuitem" className={item} onClick={view}>Open PDF in a new tab</button>
          <div className="grid gap-1.5 px-3 py-2">
            <span className="text-[.8rem] text-muted">Paper size</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
              {(["a4", "letter"] as const).map((p) => (
                <button key={p} type="button" role="menuitemradio" aria-checked={pageSize === p} onClick={() => onPageSize(p)}
                  className={"h-8 rounded-md text-[.86rem] font-semibold " + (pageSize === p ? "bg-sunk text-ink" : "text-muted")}>
                  {p === "a4" ? "A4" : "US Letter"}
                </button>
              ))}
            </div>
          </div>
          <hr className="my-1 border-line" />
          <button type="button" role="menuitem" className={item} disabled={!!busy} onClick={() => void work("primary", () => onPrimary(!isPrimary))}>
            {isPrimary ? "★ Primary CV (click to unset)" : "☆ Make this my primary CV"}
          </button>
          <button type="button" role="menuitem" className={item} disabled={!!busy} onClick={() => void work("dup", onDuplicate)}>
            {busy === "dup" ? "Copying…" : "Duplicate (tailor for another job)"}
          </button>
          <hr className="my-1 border-line" />
          <div className="grid gap-2 px-3 py-2">
            <span className="flex items-center justify-between text-[.86rem]">
              <b>Share link</b>
              <span className={"font-mono text-[.72rem] " + (shareToken ? "text-done" : "text-muted")}>{shareToken ? "ON" : "OFF"}</span>
            </span>
            {shareToken ? (
              <>
                <input readOnly value={shareUrl} aria-label="Share link" className={inputCls + " h-9 text-[.8rem]"} onFocus={(e) => e.target.select()} />
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="h-8 rounded-md bg-route px-3 text-[.82rem] font-semibold text-route-ink" onClick={copy}>Copy</button>
                  <button type="button" className="h-8 rounded-md border border-line px-3 text-[.82rem] font-semibold" disabled={!!busy}
                    onClick={() => void work("share", () => onShare(true))} title="The old link stops working">New link</button>
                  <button type="button" className="h-8 rounded-md px-3 text-[.82rem] font-semibold text-danger hover:bg-sunk" disabled={!!busy}
                    onClick={() => void work("share", () => onShare(false))}>Turn off</button>
                </div>
              </>
            ) : (
              <>
                <span className="text-[.8rem] text-muted">Anyone with the link can see this CV, including your contact details. You can turn it off at any time.</span>
                <button type="button" className="h-9 justify-self-start rounded-lg border border-line px-3 text-[.86rem] font-semibold hover:border-muted" disabled={!!busy}
                  onClick={() => void work("share", () => onShare(true))}>{busy === "share" ? "Making link…" : "Create a link"}</button>
              </>
            )}
          </div>
          <hr className="my-1 border-line" />
          <button type="button" role="menuitem" onClick={() => (armed ? onDelete() : setArmed(true))}
            className={"h-10 rounded-lg px-3 text-left " + (armed ? "bg-danger/10 font-semibold text-danger" : "text-danger hover:bg-sunk")}>
            {armed ? "Click again to delete for good" : "Delete this CV"}
          </button>
        </div>
      )}
    </div>
  );
}
