"use client";

import { useState } from "react";
import { encode, renderPdfPage, saveBlob, zipFiles } from "@/lib/tools/browser";
import { formatBytes, pagesOf, parsePageRanges } from "@/lib/tools/files";
import { baseName, PdfChooser, useSinglePdf } from "./pdfShared";
import { DownloadIcon, errorText, Field, inputClass, Notice, Progress, Segmented, useObjectUrls } from "./ui";

type Format = "image/jpeg" | "image/png";
type Page = { n: number; blob: Blob; url: string; name: string; w: number; h: number };

/** PDF pages → JPG or PNG pictures, all pages or chosen ones. */
export function PdfToImage() {
  const state = useSinglePdf("render");
  const { pdf } = state;
  const urls = useObjectUrls();
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [dpi, setDpi] = useState(150);
  const [which, setWhich] = useState<"all" | "some">("all");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");

  const parsed = pdf && which === "some" ? parsePageRanges(text, pdf.pages) : null;
  const wanted = !pdf ? [] : which === "all" ? Array.from({ length: pdf.pages }, (_, i) => i + 1)
    : parsed?.ok ? [...new Set(parsed.ranges.flatMap(pagesOf))] : [];

  const reset = () => { pages.forEach((p) => urls.drop(p.url)); setPages([]); setError(""); };

  async function run() {
    if (!pdf?.doc) return;
    reset();
    setProgress({ done: 0, total: wanted.length });
    const ext = format === "image/png" ? "png" : "jpg";
    const done: Page[] = [];
    try {
      for (let i = 0; i < wanted.length; i++) {
        const n = wanted[i];
        const { canvas } = await renderPdfPage(pdf.doc, n, dpi / 72);
        const blob = await encode(canvas, format, format === "image/jpeg" ? 0.9 : undefined);
        done.push({ n, blob, url: urls.make(blob), name: `${baseName(pdf.file.name)}-page-${n}.${ext}`, w: canvas.width, h: canvas.height });
        canvas.width = 0;
        setPages([...done]);
        setProgress({ done: i + 1, total: wanted.length });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgress(null);
    }
  }

  async function downloadAll() {
    if (!pdf) return;
    saveBlob(await zipFiles(pages.map((p) => ({ name: p.name, blob: p.blob }))), `${baseName(pdf.file.name)}-images.zip`);
  }

  const busy = progress !== null;
  return (
    <div className="grid gap-5">
      <PdfChooser state={{ ...state, clear: () => { reset(); state.clear(); } }} />
      {pdf && (
        <>
          <div className="grid gap-4 rounded-2xl border border-line bg-bg/40 p-4 sm:grid-cols-2">
            <Segmented label="Format" value={format} onChange={(v) => { setFormat(v); reset(); }}
              options={[{ value: "image/jpeg", label: "JPG", title: "Smaller files" }, { value: "image/png", label: "PNG", title: "Sharpest text, bigger files" }]} />
            <Segmented label="Quality" value={dpi} onChange={(v) => { setDpi(v); reset(); }}
              options={[{ value: 150, label: "Standard", title: "150 dpi, for screens and uploads" }, { value: 220, label: "High", title: "220 dpi, for printing and small text" }]} />
            <div className="grid gap-3 sm:col-span-2">
              <Segmented label="Pages" value={which} onChange={(v) => { setWhich(v); reset(); }}
                options={[{ value: "all", label: `All ${pdf.pages}` }, { value: "some", label: "Choose pages" }]} />
              {which === "some" && (
                <Field label="Pages" hint={parsed && !parsed.ok && text.trim() ? <span className="text-danger">{parsed.error}</span> : "For example 1-3, 5."}>
                  <input className={inputClass + " max-w-md"} value={text} placeholder="1-3, 5" onChange={(e) => { setText(e.target.value); reset(); }} />
                </Field>
              )}
            </div>
          </div>

          {busy ? (
            <Progress done={progress.done} total={progress.total} label={`Drawing page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`} />
          ) : !pages.length && (
            <button type="button" className="btn big w-full sm:w-fit" onClick={run} disabled={!wanted.length}>
              Convert {wanted.length || ""} page{wanted.length === 1 ? "" : "s"}
            </button>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          {pages.length > 0 && (
            <>
              {!busy && pages.length > 1 && (
                <button type="button" className="btn big w-full sm:w-fit" onClick={downloadAll}>
                  <DownloadIcon /> Download all {pages.length} as zip ({formatBytes(pages.reduce((n, p) => n + p.blob.size, 0))})
                </button>
              )}
              <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
                {pages.map((p) => (
                  <li key={p.n} className="grid gap-2 rounded-2xl border border-line bg-bg/50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the student's own file */}
                    <img src={p.url} alt={`Page ${p.n}`} className="aspect-[3/4] w-full rounded-lg bg-white object-contain" />
                    <div className="flex items-center justify-between gap-2 px-1 text-[.84rem]">
                      <span className="grid"><b>Page {p.n}</b><span className="text-muted">{formatBytes(p.blob.size)}</span></span>
                      <button type="button" onClick={() => saveBlob(p.blob, p.name)} aria-label={`Download page ${p.n}`}
                        className="grid size-10 place-items-center rounded-xl bg-route-soft text-route transition-colors hover:bg-route hover:text-bg">
                        <DownloadIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
