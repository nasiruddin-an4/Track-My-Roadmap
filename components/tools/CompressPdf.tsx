"use client";

import { useState } from "react";
import { bytesToBlob, encode, readBytes, renderPdfPage, saveBlob } from "@/lib/tools/browser";
import { formatBytes } from "@/lib/tools/files";
import { baseName, PdfChooser, useSinglePdf } from "./pdfShared";
import { errorText, Notice, Progress, ResultCard, Segmented, SizeChange } from "./ui";

type Level = "strong" | "balanced" | "light";
/** Resolution each page is redrawn at, and the JPEG quality. */
const LEVELS: Record<Level, { dpi: number; q: number; label: string; title: string }> = {
  strong: { dpi: 96, q: 0.5, label: "Strong", title: "Smallest file; fine for reading on screen" },
  balanced: { dpi: 130, q: 0.62, label: "Balanced", title: "Smaller file, still clear (recommended)" },
  light: { dpi: 170, q: 0.75, label: "Light", title: "Sharpest; for small print or printing" },
};

/** Shrinks a PDF by redrawing each page as an image at a lower resolution. Best for scans. */
export function CompressPdf() {
  const state = useSinglePdf("render");
  const { pdf } = state;
  const [level, setLevel] = useState<Level>("balanced");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [out, setOut] = useState<{ blob: Blob; level: Level } | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (!pdf?.doc) return;
    setError("");
    setOut(null);
    setProgress({ done: 0, total: pdf.pages });
    try {
      const { dpi, q } = LEVELS[level];
      const pages: { jpg: Uint8Array; width: number; height: number }[] = [];
      for (let n = 1; n <= pdf.pages; n++) {
        const { canvas, widthPt, heightPt } = await renderPdfPage(pdf.doc, n, dpi / 72);
        pages.push({ jpg: await readBytes(await encode(canvas, "image/jpeg", q)), width: widthPt, height: heightPt });
        canvas.width = 0;
        setProgress({ done: n, total: pdf.pages });
      }
      const { pdfFromPageImages } = await import("@/lib/tools/pdfOps");
      setOut({ blob: bytesToBlob(await pdfFromPageImages(pages), "application/pdf"), level });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgress(null);
    }
  }

  const smaller = out && pdf && out.blob.size < pdf.file.size * 0.95;
  return (
    <div className="grid gap-5">
      <PdfChooser state={state} hint="Scanned certificates, marksheets and photo-heavy PDFs shrink the most." />
      {pdf && (
        <>
          <Segmented label="How much to compress" value={level} onChange={(v) => { setLevel(v); setOut(null); }}
            options={(Object.keys(LEVELS) as Level[]).map((k) => ({ value: k, label: LEVELS[k].label, title: LEVELS[k].title }))} />
          <p className="m-0 text-[.9rem] text-muted">{LEVELS[level].title}. Text becomes part of the page image, so it can’t be selected afterwards.</p>
          {progress ? (
            <Progress done={progress.done} total={progress.total} label={`Compressing page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`} />
          ) : !out && (
            <button type="button" className="btn big w-full sm:w-fit" onClick={run}>Compress PDF</button>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {out && (smaller ? (
            <ResultCard title={`${baseName(pdf.file.name)}-compressed.pdf`} detail={<SizeChange before={pdf.file.size} after={out.blob.size} />}
              onDownload={() => saveBlob(out.blob, `${baseName(pdf.file.name)}-compressed.pdf`)} label="Download PDF">
              {out.level !== "strong" && <button type="button" className="btn" onClick={() => { setLevel("strong"); setOut(null); }}>Need it smaller?</button>}
            </ResultCard>
          ) : (
            <Notice tone="warn">
              This PDF is already about as small as it gets ({formatBytes(pdf.file.size)}); compressing made it {formatBytes(out.blob.size)}.
              Keep your original{out.level !== "strong" ? ", or try Strong" : ""}.
            </Notice>
          ))}
        </>
      )}
    </div>
  );
}
