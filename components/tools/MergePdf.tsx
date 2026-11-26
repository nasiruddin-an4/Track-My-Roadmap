"use client";

import { useState } from "react";
import { bytesToBlob, readBytes, saveBlob } from "@/lib/tools/browser";
import { formatBytes } from "@/lib/tools/files";
import { DropZone, errorText, FileRow, fileId, GuestLimitNote, move, Notice, Progress, ResultCard, takeUpTo, useBatchLimit } from "./ui";

type Item = { id: string; file: File; bytes?: Uint8Array; pages?: number; error?: string };

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Several PDFs → one, in the order chosen. Each file is checked as it's added, so a locked one shows straight away. */
export function MergePdf() {
  const limit = useBatchLimit();
  const [items, setItems] = useState<Item[]>([]);
  const [dropped, setDropped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ blob: Blob; pages: number } | null>(null);
  const [error, setError] = useState("");

  async function add(files: File[]) {
    setOut(null);
    setError("");
    const pdfs = files.filter(isPdf);
    if (pdfs.length < files.length) setError("Only PDF files can be merged. Turn images into a PDF with Image to PDF first.");
    const r = takeUpTo(items.length, pdfs, limit);
    setDropped(r.dropped);
    const fresh: Item[] = r.take.map((file) => ({ id: fileId(), file }));
    setItems((list) => [...list, ...fresh]);
    const { pageCount } = await import("@/lib/tools/pdfOps");
    for (const it of fresh) {
      let patch: Partial<Item>;
      try {
        const bytes = await readBytes(it.file);
        patch = { bytes, pages: await pageCount(bytes, it.file.name) };
      } catch (e) {
        patch = { error: errorText(e) };
      }
      setItems((list) => list.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
    }
  }

  async function merge() {
    setBusy(true);
    setError("");
    try {
      const { mergePdfs } = await import("@/lib/tools/pdfOps");
      const bytes = await mergePdfs(items.map((i) => ({ bytes: i.bytes!, name: i.file.name })));
      setOut({ blob: bytesToBlob(bytes, "application/pdf"), pages: items.reduce((n, i) => n + (i.pages ?? 0), 0) });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = items.length >= 2 && items.every((i) => i.bytes && !i.error);
  const reading = items.some((i) => !i.bytes && !i.error);
  return (
    <div className="grid gap-5">
      <DropZone accept="application/pdf,.pdf" multiple onFiles={add} compact={items.length > 0}
        title={items.length ? "Add more PDFs" : "Choose PDFs"} hint={items.length ? undefined : "Add two or more. You can change the order next."} />
      <GuestLimitNote dropped={dropped} />
      {error && <Notice tone="error">{error}</Notice>}

      {items.length > 0 && (
        <ol className="m-0 grid list-none gap-2 p-0" aria-label="Files, in the order they’ll be merged">
          {items.map((it, i) => (
            <FileRow key={it.id} name={it.file.name} size={it.file.size} index={i} count={items.length} error={it.error}
              meta={it.pages !== undefined ? <span>· {it.pages} page{it.pages === 1 ? "" : "s"}</span> : !it.error && <span>· reading…</span>}
              onMove={busy ? undefined : (a, b) => { setItems(move(items, a, b)); setOut(null); }}
              onRemove={busy ? undefined : () => { setItems(items.filter((x) => x.id !== it.id)); setOut(null); }} />
          ))}
        </ol>
      )}

      {items.length === 1 && !items[0].error && <p className="m-0 text-[.92rem] text-muted">Add at least one more PDF to merge.</p>}
      {items.some((i) => i.error) && <Notice tone="warn">Remove the files marked in red to merge the rest.</Notice>}

      {busy ? <Progress done={0} total={1} label="Merging…" /> : ready && !out && (
        <button type="button" className="btn big w-full sm:w-fit" onClick={merge} disabled={reading}>
          Merge {items.length} PDFs
        </button>
      )}
      {out && (
        <ResultCard title="merged.pdf" detail={`${out.pages} pages · ${formatBytes(out.blob.size)}`}
          onDownload={() => saveBlob(out.blob, "merged.pdf")} label="Download PDF" />
      )}
    </div>
  );
}
