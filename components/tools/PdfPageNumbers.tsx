"use client";

import { useState } from "react";
import { bytesToBlob, saveBlob } from "@/lib/tools/browser";
import { formatBytes } from "@/lib/tools/files";
import { pageLabel, type NumberStyle, type Spot } from "@/lib/tools/pageLabels";
import { baseName, PdfChooser, useSinglePdf } from "./pdfShared";
import { errorText, Field, inputClass, Notice, Progress, ResultCard, Segmented, Toggle } from "./ui";

const SPOTS: Spot[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
const STYLES: NumberStyle[] = ["n", "page-n", "n-of-total", "page-n-of-total"];

/** Page numbers on every page (or all but the cover), placed and styled as chosen. */
export function PdfPageNumbers() {
  const state = useSinglePdf("edit");
  const { pdf } = state;
  const [spot, setSpot] = useState<Spot>("bottom-center");
  const [style, setStyle] = useState<NumberStyle>("n");
  const [start, setStart] = useState("1");
  const [size, setSize] = useState(11);
  const [skipFirst, setSkipFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Blob | null>(null);
  const [error, setError] = useState("");

  const first = Number(start);
  const badStart = !Number.isInteger(first) || first < 0 || first > 99999;
  const total = pdf ? first + pdf.pages - (skipFirst ? 1 : 0) - 1 : 0;
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setOut(null); };

  async function run() {
    if (!pdf) return;
    setBusy(true);
    setError("");
    try {
      const { addPageNumbers } = await import("@/lib/tools/pdfOps");
      const bytes = await addPageNumbers(pdf.bytes, { style, spot, start: first, fontSize: size, skipFirst });
      setOut(bytesToBlob(bytes, "application/pdf"));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PdfChooser state={state} hint="Your project report, thesis or assignment." />
      {pdf && (
        <>
          <div className="grid gap-6 rounded-2xl border border-line bg-bg/40 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5">
            <fieldset className="m-0 grid content-start gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[.88rem] font-semibold text-muted">Where on the page</legend>
              {/* a little page: tap where the number should go */}
              <div className="relative grid aspect-[1/1.414] w-36 grid-rows-[auto_1fr_auto] rounded-lg bg-white p-1.5 shadow-(--shadow)">
                {[0, 1].map((row) => (
                  <div key={row} className={"grid grid-cols-3 gap-1 " + (row === 1 ? "row-start-3" : "")}>
                    {SPOTS.slice(row * 3, row * 3 + 3).map((s) => (
                      <label key={s} title={s.replace("-", " ")}
                        className={"grid h-8 cursor-pointer place-items-center rounded-md text-[.72rem] font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-route "
                          + (spot === s ? "bg-route text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                        <input type="radio" name="spot" className="sr-only" checked={spot === s} onChange={() => change(setSpot)(s)} aria-label={s.replace("-", " ")} />
                        {spot === s ? (badStart ? "#" : first) : "·"}
                      </label>
                    ))}
                  </div>
                ))}
                <div aria-hidden="true" className="row-start-2 grid content-center gap-1.5 px-2">
                  {[90, 100, 80, 95, 60].map((w, i) => <span key={i} className="h-1 rounded bg-slate-200" style={{ width: `${w}%` }} />)}
                </div>
              </div>
            </fieldset>
            <div className="grid content-start gap-4">
              <Segmented label="Style" value={style} onChange={change(setStyle)}
                options={STYLES.map((s) => ({ value: s, label: pageLabel(s, 1, Math.max(total, 1)) }))} />
              <div className="flex flex-wrap items-end gap-4">
                <Field label="First number" hint={badStart ? <span className="text-danger">A whole number, 0 or more.</span> : undefined}>
                  <input className={inputClass + " w-28"} inputMode="numeric" value={start} onChange={(e) => change(setStart)(e.target.value)} />
                </Field>
                <Segmented label="Size" value={size} onChange={change(setSize)}
                  options={[{ value: 9, label: "Small" }, { value: 11, label: "Medium" }, { value: 14, label: "Large" }]} />
              </div>
              {pdf.pages > 1 && (
                <Toggle checked={skipFirst} onChange={change(setSkipFirst)}>Skip the cover page (no number on page 1)</Toggle>
              )}
            </div>
          </div>
          {busy ? <Progress done={0} total={1} label="Adding numbers…" /> : !out && (
            <button type="button" className="btn big w-full sm:w-fit" onClick={run} disabled={badStart}>Add page numbers</button>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {out && (
            <ResultCard title={`${baseName(pdf.file.name)}-numbered.pdf`} detail={`${pdf.pages} pages · ${formatBytes(out.size)}`}
              onDownload={() => saveBlob(out, `${baseName(pdf.file.name)}-numbered.pdf`)} label="Download PDF" />
          )}
        </>
      )}
    </div>
  );
}
