"use client";

import { useEffect, useState } from "react";
import { openPdfForRender, readBytes, type RenderablePdf } from "@/lib/tools/browser";
import { formatBytes } from "@/lib/tools/files";
import { DropZone, errorText, Notice } from "./ui";

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** "Report final.pdf" → "Report final" */
export const baseName = (name: string) => name.replace(/\.[^./\\]+$/, "") || "document";

type Loaded = { file: File; bytes: Uint8Array; pages: number; doc?: RenderablePdf };

/**
 * One PDF chosen by the student. `engine` "edit" opens it with pdf-lib (to change pages); "render" opens it
 * with PDF.js (to draw pages), which also reads PDFs that are only locked against editing.
 */
export function useSinglePdf(engine: "edit" | "render") {
  const [pdf, setPdf] = useState<Loaded | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  useEffect(() => () => { void pdf?.doc?.loadingTask.destroy(); }, [pdf]);

  async function choose(files: File[]) {
    const f = files[0];
    if (!f) return;
    setError("");
    if (!isPdf(f)) { setError("That isn’t a PDF. Choose a file ending in .pdf."); return; }
    setPdf(null);
    setName(f.name);
    setReading(true);
    try {
      const bytes = await readBytes(f);
      if (engine === "edit") {
        const { pageCount } = await import("@/lib/tools/pdfOps");
        setPdf({ file: f, bytes, pages: await pageCount(bytes, f.name) });
      } else {
        const doc = await openPdfForRender(bytes, f.name);
        setPdf({ file: f, bytes, pages: doc.numPages, doc });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setReading(false);
    }
  }

  return { pdf, name, error, reading, choose, clear: () => { setPdf(null); setError(""); setName(""); } };
}

/** The drop zone until a PDF is chosen, then a card for it with a way to pick another. */
export function PdfChooser({ state, hint }: { state: ReturnType<typeof useSinglePdf>; hint?: string }) {
  const { pdf, name, error, reading, choose, clear } = state;
  return (
    <div className="grid gap-3">
      {pdf || reading ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-bg/50 p-3 pr-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 flex-none place-items-center rounded-xl bg-[rgba(255,90,0,.12)] font-mono text-[.72rem] font-semibold text-highlight">PDF</span>
            <span className="grid min-w-0">
              <b className="truncate" title={name}>{name}</b>
              <span className="text-[.86rem] text-muted">
                {pdf ? `${pdf.pages} page${pdf.pages === 1 ? "" : "s"} · ${formatBytes(pdf.file.size)}` : "Reading…"}
              </span>
            </span>
          </div>
          <button type="button" className="btn ghost" onClick={clear} disabled={reading}>Choose another PDF</button>
        </div>
      ) : (
        <DropZone accept="application/pdf,.pdf" onFiles={choose} title="Choose a PDF" hint={hint} />
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
