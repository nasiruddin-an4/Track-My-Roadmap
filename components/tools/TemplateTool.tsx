"use client";

import { Hind_Siliguri } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { encode, openImage, saveBlob, scaleTo } from "@/lib/tools/browser";
import {
  blocksToText, getTemplate, initialValues, type Block, type FieldDef, type Lang, type Values,
} from "@/lib/tools/templates";
import { useIsClient } from "@/lib/useLocal";
import { DownloadIcon, errorText, inputClass, Notice, Spinner } from "./ui";

// Bengali documents are shown and printed in this font; only fetched when a Bengali document is open
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "700"], preload: false, display: "swap" });
const SERIF = "'Times New Roman', Times, 'Liberation Serif', serif";

/** Details a student types once and gets in every template (name, school, roll…), kept on this device only. */
const KEY = "tmr-doc-details";
function remembered(): Values {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Values; } catch { return {}; }
}
function remember(v: Values, fields: FieldDef[]) {
  try {
    const all = remembered();
    for (const f of fields) if (f.shared) all[f.key] = v[f.key] ?? "";
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A ready-made document: fill in the form, check the page, then print, download for Word, or copy the text. */
export function TemplateTool({ slug }: { slug: string }) {
  // today's date and remembered details exist only in the browser, so the form starts there
  const client = useIsClient();
  if (!client) return <div className="grid min-h-[480px] place-items-center text-muted" aria-busy="true"><Spinner /></div>;
  return <Editor slug={slug} />;
}

function Editor({ slug }: { slug: string }) {
  const t = getTemplate(slug);
  const [lang, setLang] = useState<Lang>(t.langs[0]);
  const [v, setV] = useState<Values>(() => initialValues(t, localToday(), remembered()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const blocks = useMemo(() => t.render(v, lang), [t, v, lang]);

  const set = (key: string, value: string) => {
    const next = { ...v, [key]: value };
    setV(next);
    setCopied(false);
    if (t.fields.find((f) => f.key === key)?.shared) remember(next, t.fields);
  };

  // print just the page: render a clean copy under <body>, hide everything else while printing
  useEffect(() => {
    if (!printing) return;
    const html = document.documentElement;
    html.classList.add("print-doc");
    const done = () => { html.classList.remove("print-doc"); setPrinting(false); };
    window.addEventListener("afterprint", done, { once: true });
    const timer = setTimeout(() => window.print(), 80);
    return () => { clearTimeout(timer); window.removeEventListener("afterprint", done); html.classList.remove("print-doc"); };
  }, [printing]);

  async function word() {
    setBusy(true);
    setError("");
    try {
      const { blocksToDocx } = await import("@/lib/tools/templateDocx");
      saveBlob(await blocksToDocx(blocks, lang, t.fileName(v, lang)), `${t.fileName(v, lang)}.docx`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const text = blocksToText(blocks);
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { window.prompt("Copy the text:", text); }
  }

  const visible = t.fields.filter((f) => (!f.langs || f.langs.includes(lang)) && (!f.show || f.show(v)));
  const missing = blocksToText(blocks).match(/\[[^\]]+\]/g)?.length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)] lg:gap-8">
      <div className="grid content-start gap-4">
        {t.langs.length > 1 && (
          <div role="radiogroup" aria-label="Language" className="flex w-fit gap-1 rounded-xl bg-bg p-1 ring-1 ring-line">
            {t.langs.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => setLang(l)}
                className={"h-10 rounded-lg px-4 font-semibold transition-colors " + (lang === l ? "bg-route text-route-ink" : "text-muted hover:text-ink")}>
                {l === "en" ? "English" : <span lang="bn">বাংলা</span>}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2" lang={lang === "bn" ? "bn" : undefined}>
          {visible.map((f) => <FieldInput key={f.key} f={f} lang={lang} value={v[f.key] ?? ""} onChange={(x) => set(f.key, x)} />)}
        </div>
        <p className="m-0 text-[.84rem] text-muted">
          Your name, school and roll are remembered on this device for the other templates. Nothing is sent to us.
        </p>
      </div>

      <div className="grid content-start gap-3 lg:sticky lg:top-[calc(var(--top)+16px)] lg:self-start">
        <DocPage blocks={blocks} lang={lang} />
        {missing > 0 && <p className="m-0 text-[.88rem] text-warm">{missing} thing{missing === 1 ? "" : "s"} in [brackets] still to fill in.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn big" onClick={() => setPrinting(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></svg>
            Print or save as PDF
          </button>
          <button type="button" className="btn !min-h-[50px] !px-5" onClick={word} disabled={busy}>
            {busy ? <Spinner /> : <DownloadIcon />} Word file
          </button>
          <button type="button" className="btn !min-h-[50px] !px-5" onClick={copy}>{copied ? "Copied" : "Copy text"}</button>
        </div>
        <p className="m-0 text-[.82rem] text-muted">To save a PDF, choose “Save as PDF” as the printer. On a phone: Share → Print → pinch out on the preview → Save.</p>
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      {printing && createPortal(<div className="print-portal"><Sheet blocks={blocks} lang={lang} /></div>, document.body)}
    </div>
  );
}

function FieldInput({ f, lang, value, onChange }: { f: FieldDef; lang: Lang; value: string; onChange: (v: string) => void }) {
  const label = f.label[lang];
  const ph = f.placeholder?.[lang];
  const wide = !f.half || f.kind === "textarea" || f.kind === "image";
  const box = "grid min-w-0 content-start gap-1.5 " + (wide ? "sm:col-span-2" : "");
  const caption = <span className="text-[.86rem] font-semibold text-muted">{label}</span>;
  if (f.kind === "select") {
    return (
      <label className={box}>{caption}
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label[lang]}</option>)}
        </select>
      </label>
    );
  }
  if (f.kind === "textarea") {
    return (
      <label className={box}>{caption}
        <textarea className={inputClass + " h-auto min-h-24 py-2.5 leading-relaxed"} rows={3} value={value} placeholder={ph} maxLength={1200} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  if (f.kind === "image") return <LogoInput label={label} value={value} onChange={onChange} />;
  return (
    <label className={box}>{caption}
      <input className={inputClass} type={f.kind === "date" ? "date" : "text"} value={value} placeholder={ph} maxLength={160} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** A logo for the cover page, shrunk and kept as a PNG in the form (never uploaded). */
function LogoInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [error, setError] = useState("");
  async function take(file?: File) {
    if (!file) return;
    setError("");
    try {
      const pic = await openImage(file, 400);
      const c = scaleTo(pic.source, pic.width, pic.height, pic.width, pic.height);
      pic.close();
      const blob = await encode(c, "image/png");
      const reader = new FileReader();
      reader.onload = () => onChange(String(reader.result));
      reader.readAsDataURL(blob);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <span className="text-[.86rem] font-semibold text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the student's own file */}
        {value && <img src={value} alt="" className="size-12 rounded-lg bg-white object-contain p-1" />}
        <label className="btn cursor-pointer">
          {value ? "Change logo" : "Add logo"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {value && <button type="button" className="btn ghost" onClick={() => onChange("")}>Remove</button>}
      </div>
      {error && <span className="text-[.84rem] text-danger">{error}</span>}
    </div>
  );
}

/* A4 is 794×1123 CSS pixels; the page has 25 mm (94 px) margins. */
const PAGE_W = 794, PAGE_H = 1123;

/** The document on screen at real A4 size, scaled to fit. */
function DocPage({ blocks, lang }: { blocks: Block[]; lang: Lang }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="w-full" aria-label="Preview of your document">
      <div style={{ height: PAGE_H * scale }} className="relative overflow-hidden rounded-[4px] shadow-[0_18px_40px_rgba(0,0,0,.35)]">
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          <Sheet blocks={blocks} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function Sheet({ blocks, lang }: { blocks: Block[]; lang: Lang }) {
  const pt = (n: number) => `${(n * 4) / 3}px`;
  const bn = lang === "bn";
  return (
    <div className="doc-page" lang={bn ? "bn" : "en"}
      style={{ width: PAGE_W, minHeight: PAGE_H, padding: "94px 88px", background: "#fff", color: "#111", fontFamily: bn ? hind.style.fontFamily : SERIF, fontSize: pt(12), lineHeight: bn ? 1.65 : 1.45 }}>
      {blocks.map((b, i) => {
        const gap = b.gap ? pt(b.gap) : 0;
        if (b.t === "p") {
          return (
            <p key={i} style={{ margin: 0, marginTop: gap, textAlign: b.align ?? "left", fontSize: b.size ? pt(b.size) : undefined, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {b.runs.map((r, j) => (r.bold ? <b key={j}>{r.text}</b> : <span key={j}>{r.text}</span>))}
            </p>
          );
        }
        if (b.t === "bullets") {
          return <ul key={i} style={{ margin: 0, marginTop: gap, paddingLeft: 22 }}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
        }
        if (b.t === "image") {
          // eslint-disable-next-line @next/next/no-img-element -- the student's own logo, kept in the page
          return <img key={i} src={b.src} alt="" style={{ display: "block", width: pt(b.width), margin: `${gap} auto 0` }} />;
        }
        return (
          <div key={i} style={{ marginTop: gap, display: "grid", gridTemplateColumns: `repeat(${b.cols.length}, minmax(0, 1fr))`, gap: 32 }}>
            {b.cols.map((c, j) => (
              <div key={j}>
                <p style={{ margin: "0 0 6px", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>{c.title}</p>
                {c.lines.map((l, k) => <p key={k} style={{ margin: 0 }}>{l.map((r, m) => (r.bold ? <b key={m}>{r.text}</b> : <span key={m}>{r.text}</span>))}</p>)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
