"use client";

import { useState } from "react";
import { bytesToBlob, encode, openImage, readBytes, saveBlob, scaleTo } from "@/lib/tools/browser";
import { formatBytes, withExtension } from "@/lib/tools/files";
import type { Orientation, PageSize, PdfImage } from "@/lib/tools/pdfOps";
import {
  DropZone, errorText, FileRow, fileId, GuestLimitNote, move, Notice, Progress, ResultCard, Segmented, takeUpTo,
  useBatchLimit, useObjectUrls,
} from "./ui";

type Item = { id: string; file: File; thumb: string };
type Quality = "standard" | "high";
const QUALITY: Record<Quality, { side: number; q: number }> = { standard: { side: 2000, q: 0.82 }, high: { side: 3200, q: 0.92 } };

/** Photos of assignment pages → one PDF, a page per photo, in the order chosen. */
export function ImageToPdf() {
  const limit = useBatchLimit();
  const urls = useObjectUrls();
  const [items, setItems] = useState<Item[]>([]);
  const [dropped, setDropped] = useState(0);
  const [size, setSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [margin, setMargin] = useState(18);
  const [quality, setQuality] = useState<Quality>("standard");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [out, setOut] = useState<{ blob: Blob; name: string } | null>(null);
  const [error, setError] = useState("");

  const changed = () => { setOut(null); setError(""); };

  function add(files: File[]) {
    const r = takeUpTo(items.length, files, limit);
    setDropped(r.dropped);
    setItems([...items, ...r.take.map((file) => ({ id: fileId(), file, thumb: urls.make(file) }))]);
    changed();
  }

  async function make() {
    changed();
    setProgress({ done: 0, total: items.length + 1 });
    try {
      const { side, q } = QUALITY[quality];
      const images: PdfImage[] = [];
      for (let n = 0; n < items.length; n++) {
        const pic = await openImage(items[n].file, side);
        try {
          // every picture becomes a JPEG on white: smaller than PNG, and any format the browser opens works
          const canvas = scaleTo(pic.source, pic.width, pic.height, pic.width, pic.height, "#fff");
          images.push({ bytes: await readBytes(await encode(canvas, "image/jpeg", q)), kind: "jpg", width: canvas.width, height: canvas.height });
          canvas.width = 0;
        } finally {
          pic.close();
        }
        setProgress({ done: n + 1, total: items.length + 1 });
      }
      const { imagesToPdf } = await import("@/lib/tools/pdfOps");
      const bytes = await imagesToPdf(images, { size, orientation, margin });
      const name = items.length === 1 ? withExtension(items[0].file.name, "pdf") : "images.pdf";
      setOut({ blob: bytesToBlob(bytes, "application/pdf"), name });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  return (
    <div className="grid gap-5">
      <DropZone accept="image/*" multiple paste onFiles={add} compact={items.length > 0}
        title={items.length ? "Add more images" : "Choose images"} hint={items.length ? undefined : "Photos or scans of your pages. JPG, PNG or WebP; HEIC in Safari."} />
      <GuestLimitNote dropped={dropped} />

      {items.length > 0 && (
        <>
          <ol className="m-0 grid list-none gap-2 p-0" aria-label="Pages, in order">
            {items.map((it, i) => (
              <FileRow key={it.id} name={it.file.name} size={it.file.size} thumb={it.thumb} index={i} count={items.length}
                meta={<span>· page {i + 1}</span>}
                onMove={busy ? undefined : (a, b) => { setItems(move(items, a, b)); changed(); }}
                onRemove={busy ? undefined : () => { urls.drop(it.thumb); setItems(items.filter((x) => x.id !== it.id)); changed(); }} />
            ))}
          </ol>

          <div className="grid gap-4 rounded-2xl border border-line bg-bg/40 p-4 sm:grid-cols-2">
            <Segmented label="Page size" value={size} onChange={(v) => { setSize(v); changed(); }}
              options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }, { value: "fit", label: "Fit to image" }]} />
            {size !== "fit" && (
              <Segmented label="Orientation" value={orientation} onChange={(v) => { setOrientation(v); changed(); }}
                options={[{ value: "auto", label: "Auto" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />
            )}
            <Segmented label="Margin" value={margin} onChange={(v) => { setMargin(v); changed(); }}
              options={[{ value: 0, label: "None" }, { value: 18, label: "Small" }, { value: 42, label: "Large" }]} />
            <Segmented label="Image quality" value={quality} onChange={(v) => { setQuality(v); changed(); }}
              options={[{ value: "standard", label: "Standard", title: "Smaller file, fine for uploads" }, { value: "high", label: "High", title: "Sharper, for printing" }]} />
          </div>

          {busy ? (
            <Progress done={progress.done} total={progress.total} label={progress.done < items.length ? `Adding image ${progress.done + 1} of ${items.length}…` : "Making the PDF…"} />
          ) : !out && (
            <button type="button" className="btn big w-full sm:w-fit" onClick={make}>
              Make PDF ({items.length} page{items.length === 1 ? "" : "s"})
            </button>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {out && (
            <ResultCard title={out.name} detail={`${items.length} page${items.length === 1 ? "" : "s"} · ${formatBytes(out.blob.size)}`}
              onDownload={() => saveBlob(out.blob, out.name)} label="Download PDF" />
          )}
        </>
      )}
    </div>
  );
}
