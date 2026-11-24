"use client";

import { useEffect, useRef, useState } from "react";
import type { CvData } from "@/lib/cv/schema";

export type ParseResult = { data: CvData; upload: string | null; fileName: string };

const MAX = 5 * 1024 * 1024;
const STEPS = ["Uploading your CV…", "Reading the text…", "Sorting it into sections…", "Almost there…"];

/** Drop or choose a PDF/DOCX; it's read on the server and handed back as CV sections for review. */
export function CvUploadDropzone({ onParsed }: { onParsed: (r: ParseResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [busy]);

  const send = async (file: File) => {
    setError("");
    if (!/\.(pdf|docx)$/i.test(file.name)) { setError("Please choose a PDF or a Word (.docx) file."); return; }
    if (file.size > MAX) { setError("That file is over 5 MB. Please choose a smaller one."); return; }
    setBusy(true);
    setStep(0);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/cv/parse", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "We couldn’t read that CV. Please try again.");
      onParsed({ data: j.data, upload: j.upload ?? null, fileName: j.fileName ?? file.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <label
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !busy) void send(f); }}
        className={"grid min-h-44 cursor-pointer place-items-center rounded-[18px] border-2 border-dashed p-6 text-center transition-colors "
          + (busy ? "cursor-wait border-route bg-route-soft" : drag ? "border-highlight bg-[rgba(255,90,0,.08)]" : "border-line hover:border-muted")}>
        <input ref={input} type="file" className="sr-only" disabled={busy}
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
        {busy ? (
          <span className="grid justify-items-center gap-3" role="status">
            <span className="size-8 animate-spin rounded-full border-[3px] border-route border-t-transparent" aria-hidden="true" />
            <b>{STEPS[step]}</b>
            <span className="text-[.86rem] text-muted">This usually takes 15–40 seconds.</span>
          </span>
        ) : (
          <span className="grid justify-items-center gap-2">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
              <path d="M12 15V3m-4 4 4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            <b>Drop your CV here, or <span className="text-route">choose a file</span></b>
            <span className="text-[.86rem] text-muted">PDF or Word (.docx), up to 5 MB</span>
          </span>
        )}
      </label>
      {error && <p className="m-0 text-[.9rem] text-danger" role="alert">{error}</p>}
    </div>
  );
}
