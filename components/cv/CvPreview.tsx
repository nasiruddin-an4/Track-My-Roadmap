"use client";

import { useEffect, useRef, useState } from "react";
import { layoutCv, type Run } from "@/lib/cv/format";
import type { CvData, PageSize } from "@/lib/cv/schema";

/*
 * The "classic" template on screen: the same lines as the PDF and Word file (layoutCv in lib/cv/format.ts), drawn at
 * real page size and scaled to fit. Black on white, whatever the app theme. Faint lines mark page breaks.
 * Everything is plain text: links aren't clickable, so nothing typed into a CV can run in the page.
 */
const PAGE = { a4: { w: 793.7, h: 1122.5 }, letter: { w: 816, h: 1056 } } as const;

export function CvPreview({ data, pageSize }: { data: CvData; pageSize: PageSize }) {
  const box = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState<number>(PAGE[pageSize].h);
  const { w, h } = PAGE[pageSize];

  useEffect(() => {
    const el = box.current, page = sheet.current;
    if (!el || !page) return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / w));
      setHeight(Math.max(h, page.offsetHeight));
    });
    ro.observe(el);
    ro.observe(page);
    return () => ro.disconnect();
  }, [w, h]);

  const pages = Math.max(1, Math.ceil((height - 2) / h));

  return (
    <div ref={box} className="w-full">
      <div style={{ height: height * scale }} className="relative">
        <div ref={sheet} className="cv-sheet absolute top-0 left-0 origin-top-left"
          style={{ width: w, minHeight: h, transform: `scale(${scale})`,
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${h - 1}px, #cbd5e1 ${h - 1}px, #cbd5e1 ${h}px)` }}>
          <Sheet data={data} />
        </div>
      </div>
      <p className="mt-2 text-center font-mono text-[.74rem] text-muted">
        {pageSize === "a4" ? "A4" : "US Letter"} · {pages} {pages === 1 ? "page" : "pages"}{pages > 2 ? " · most CVs fit on 1–2 pages" : ""}
      </p>
    </div>
  );
}

function Sheet({ data }: { data: CvData }) {
  const l = layoutCv(data);
  const empty = !l.name && !l.contact && !l.sections.length;
  const line = (runs: Run[]) => runs.map((r, i) => (r.bold ? <b key={i}>{r.text}</b> : r.text));
  return (
    <>
      {l.name ? <div className="cv-name">{l.name}</div> : empty && <div className="cv-name" style={{ color: "#9ca3af" }}>Your Name</div>}
      {l.label && <div className="cv-label">{l.label}</div>}
      {l.contact && <div className="cv-contact">{l.contact}</div>}
      {empty && <p className="cv-hint">Fill in the form and your CV appears here.</p>}
      {l.sections.map((sec) => (
        <section key={sec.key} className="cv-sec">
          <h3>{sec.title}</h3>
          {sec.kind === "lines"
            ? sec.lines.map((r, i) => <p key={i} className="cv-p">{line(r)}</p>)
            : sec.entries.map((e, i) => (
              <div key={i} className="cv-item">
                <div>{line(e.head)}</div>
                {e.meta && <div className="cv-meta">{e.meta}</div>}
                {e.paras.map((p, j) => <p key={j} className="cv-p">{p}</p>)}
                {e.bullets.length > 0 && <ul className="cv-bullets">{e.bullets.map((x, j) => <li key={j}><span aria-hidden="true">•</span>{x}</li>)}</ul>}
              </div>
            ))}
        </section>
      ))}
    </>
  );
}
