"use client";

import { useDeferredValue, useState } from "react";
import { bijoyToUnicode, looksLikeUnicodeBengali, unicodeToBijoy } from "@/lib/tools/bijoy";
import { saveBlob } from "@/lib/tools/browser";
import { Segmented } from "./ui";

type Dir = "auto" | "b2u" | "u2b";
const EXAMPLE_BIJOY = "Avgvi †mvbvi evsjv, Avwg †Zvgvq fv‡jvevwm|";

/** Bijoy (SutonnyMJ) ↔ Unicode, converted as you type. */
export function BijoyConverter() {
  const [dir, setDir] = useState<Dir>("auto");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const input = useDeferredValue(text);

  const detected: "b2u" | "u2b" = looksLikeUnicodeBengali(input) ? "u2b" : "b2u";
  const way = dir === "auto" ? detected : dir;
  const output = !input ? "" : way === "b2u" ? bijoyToUnicode(input) : unicodeToBijoy(input);
  const from = way === "b2u" ? "Bijoy" : "Unicode", to = way === "b2u" ? "Unicode" : "Bijoy";

  async function copy() {
    try { await navigator.clipboard.writeText(output); }
    catch { window.prompt("Copy the text:", output); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function swap() {
    setText(output);
    setDir(way === "b2u" ? "u2b" : "b2u");
  }

  const edit = (v: string) => { setText(v); setCopied(false); };
  const boxClass = "min-h-56 w-full resize-y rounded-2xl border border-line bg-bg p-4 text-[1.05rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-route sm:min-h-72";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented label="Convert" value={dir} onChange={setDir}
          options={[
            { value: "auto", label: input && dir === "auto" ? `Auto (${detected === "b2u" ? "Bijoy → Unicode" : "Unicode → Bijoy"})` : "Auto-detect" },
            { value: "b2u", label: "Bijoy → Unicode" },
            { value: "u2b", label: "Unicode → Bijoy" },
          ]} />
        <div className="flex gap-2">
          <button type="button" className="btn ghost" onClick={() => { setDir("auto"); edit(EXAMPLE_BIJOY); }}>Try an example</button>
          {text && <button type="button" className="btn ghost" onClick={() => edit("")}>Clear</button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
        <label className="grid content-start gap-2">
          <span className="flex justify-between text-[.88rem] font-semibold text-muted">
            {from} text <span className="mono font-normal">{text.length.toLocaleString()} characters</span>
          </span>
          <textarea className={boxClass} value={text} onChange={(e) => edit(e.target.value)} spellCheck={false}
            lang={way === "u2b" ? "bn" : undefined}
            placeholder={way === "b2u" ? "Paste Bijoy (SutonnyMJ) text here, e.g. Avgvi †mvbvi evsjv" : "এখানে ইউনিকোড বাংলা লিখুন বা পেস্ট করুন"} />
        </label>

        <div className="grid place-items-center">
          <button type="button" onClick={swap} disabled={!output} aria-label="Swap: convert the result back the other way"
            title="Swap direction"
            className="grid size-11 place-items-center rounded-full border border-line bg-surface text-muted transition hover:border-route hover:text-route disabled:opacity-40 lg:rotate-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rotate-90 lg:rotate-0">
              <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
            </svg>
          </button>
        </div>

        <label className="grid content-start gap-2">
          <span className="flex justify-between text-[.88rem] font-semibold text-muted">
            {to} result <span className="mono font-normal">{output.length.toLocaleString()} characters</span>
          </span>
          <textarea className={boxClass + " bg-band"} value={output} readOnly spellCheck={false} lang={way === "b2u" ? "bn" : undefined}
            placeholder="The converted text appears here" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn big" onClick={copy} disabled={!output} aria-live="polite">
          {copied ? "Copied" : `Copy ${to} text`}
        </button>
        <button type="button" className="btn !min-h-[50px] !px-5" disabled={!output}
          onClick={() => saveBlob(new Blob(["﻿" + output], { type: "text/plain;charset=utf-8" }), way === "b2u" ? "unicode.txt" : "bijoy.txt")}>
          Download .txt
        </button>
        {way === "u2b" && output && (
          <p className="m-0 text-[.88rem] text-muted">Paste this into a document set in the SutonnyMJ font to see Bengali.</p>
        )}
      </div>
    </div>
  );
}
