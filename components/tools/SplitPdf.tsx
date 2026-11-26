"use client";

import { useState } from "react";
import { bytesToBlob, saveBlob, zipFiles } from "@/lib/tools/browser";
import { formatBytes, pagesOf, parsePageRanges, rangeLabel } from "@/lib/tools/files";
import { baseName, PdfChooser, useSinglePdf } from "./pdfShared";
import { errorText, Field, inputClass, Notice, Progress, ResultCard, Segmented } from "./ui";

type Mode = "pick" | "ranges" | "each";

/** Pages out of a PDF: one new PDF of chosen pages, a file per range, or a file per page. */
export function SplitPdf() {
  const state = useSinglePdf("edit");
  const { pdf } = state;
  const [mode, setMode] = useState<Mode>("pick");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ blob: Blob; name: string; detail: string } | null>(null);
  const [error, setError] = useState("");

  const parsed = pdf && mode !== "each" ? parsePageRanges(text, pdf.pages) : null;
  const ranges = parsed?.ok ? parsed.ranges : [];
  const plan = !pdf ? "" : mode === "each" ? `${pdf.pages} PDFs, one per page, in a zip`
    : !parsed?.ok ? ""
    : mode === "pick" ? `1 PDF with ${ranges.reduce((n, r) => n + r.to - r.from + 1, 0)} pages`
    : ranges.length === 1 ? "1 PDF" : `${ranges.length} PDFs, one per range, in a zip`;

  async function run() {
    if (!pdf) return;
    setBusy(true);
    setError("");
    setOut(null);
    try {
      const { pickPages, splitPdf } = await import("@/lib/tools/pdfOps");
      const base = baseName(pdf.file.name);
      if (mode === "pick") {
        const pages = ranges.flatMap(pagesOf);
        const bytes = await pickPages(pdf.bytes, pages);
        const label = ranges.length <= 2 ? ranges.map(rangeLabel).join("_") : "selected-pages";
        setOut({ blob: bytesToBlob(bytes, "application/pdf"), name: `${base}-${label}.pdf`, detail: `${pages.length} page${pages.length === 1 ? "" : "s"}` });
      } else {
        const groups = mode === "each" ? Array.from({ length: pdf.pages }, (_, i) => [i + 1]) : ranges.map(pagesOf);
        const names = mode === "each" ? groups.map((g) => `${base}-page-${g[0]}.pdf`) : ranges.map((r) => `${base}-${rangeLabel(r)}.pdf`);
        const parts = await splitPdf(pdf.bytes, groups);
        if (parts.length === 1) {
          setOut({ blob: bytesToBlob(parts[0], "application/pdf"), name: names[0], detail: `${groups[0].length} pages` });
        } else {
          const zip = await zipFiles(parts.map((p, i) => ({ name: names[i], blob: bytesToBlob(p, "application/pdf") })));
          setOut({ blob: zip, name: `${base}-split.zip`, detail: `${parts.length} PDFs` });
        }
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PdfChooser state={state} />
      {pdf && (
        <>
          <Segmented label="What do you want?" value={mode} onChange={(v) => { setMode(v); setOut(null); }}
            options={[{ value: "pick", label: "Pick pages" }, { value: "ranges", label: "A file per range" }, { value: "each", label: "Every page separately" }]} />
          {mode !== "each" && (
            <Field label={mode === "pick" ? "Pages to keep" : "Ranges"}
              hint={parsed && !parsed.ok && text.trim() ? <span className="text-danger">{parsed.error}</span>
                : mode === "pick" ? "For example 1-3, 5, 8-. They come out in the order you type." : "Each range becomes its own PDF, for example 1-4, 5-9, 10-."}>
              <input className={inputClass + " max-w-md"} value={text} placeholder={`1-${Math.min(3, pdf.pages)}${pdf.pages > 4 ? ", 5" : ""}`}
                onChange={(e) => { setText(e.target.value); setOut(null); }} />
            </Field>
          )}
          {plan && !out && !busy && <p className="m-0 text-[.92rem] text-muted">You’ll get {plan}.</p>}
          {busy ? <Progress done={0} total={1} label="Splitting…" /> : !out && (
            <button type="button" className="btn big w-full sm:w-fit" onClick={run} disabled={!plan}>
              {mode === "pick" ? "Make the new PDF" : "Split PDF"}
            </button>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {out && <ResultCard title={out.name} detail={`${out.detail} · ${formatBytes(out.blob.size)}`} onDownload={() => saveBlob(out.blob, out.name)} />}
        </>
      )}
    </div>
  );
}
