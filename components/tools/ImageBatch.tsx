"use client";

import { useState } from "react";
import { compressCanvas, encode, EXT, openImage, saveBlob, scaleTo, zipFiles, type ImageType } from "@/lib/tools/browser";
import { formatBytes, KB, withExtension } from "@/lib/tools/files";
import {
  DownloadIcon, DropZone, errorText, Field, FileRow, fileId, GuestLimitNote, inputClass, Notice, Progress, Segmented,
  SizeChange, takeUpTo, useBatchLimit, useObjectUrls,
} from "./ui";

type Item = { id: string; file: File; thumb: string; out?: { blob: Blob; name: string; width: number; height: number; kept?: boolean; fits: boolean }; error?: string };
type Target = "image/jpeg" | "image/webp" | "keep";

const SIZES = [50, 100, 200, 500];
/** Phones run out of memory on very large pictures; anything bigger is shrunk to this first. */
const MAX_SIDE = 6000;

/** Several images at once: compress to a KB limit (`mode="compress"`) or convert between formats (`mode="convert"`). */
export function ImageBatch({ mode }: { mode: "compress" | "convert" }) {
  const limit = useBatchLimit();
  const urls = useObjectUrls();
  const [items, setItems] = useState<Item[]>([]);
  const [dropped, setDropped] = useState(0);
  const [kb, setKb] = useState<number | "custom">(100);
  const [customKb, setCustomKb] = useState("150");
  const [target, setTarget] = useState<Target>("image/jpeg");
  const [format, setFormat] = useState<ImageType>("image/jpeg");
  const [quality, setQuality] = useState(0.9);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const maxKb = kb === "custom" ? Number(customKb) : kb;
  const badKb = mode === "compress" && !(maxKb >= 5 && maxKb <= 50_000);
  const finished = items.filter((i) => i.out);

  /** Any change to the settings makes earlier results out of date. */
  const resetResults = () => setItems((list) => list.map((i) => ({ ...i, out: undefined, error: undefined })));

  function add(files: File[]) {
    const r = takeUpTo(items.length, files, limit);
    setDropped(r.dropped);
    setItems([...items, ...r.take.map((file) => ({ id: fileId(), file, thumb: urls.make(file) }))]);
  }

  function remove(id: string) {
    urls.drop(items.find((i) => i.id === id)?.thumb);
    setItems(items.filter((i) => i.id !== id));
  }

  async function processOne(file: File): Promise<NonNullable<Item["out"]>> {
    const outType: ImageType = mode === "convert" ? format
      : target === "keep" ? (["image/png", "image/webp"].includes(file.type) ? (file.type as ImageType) : "image/jpeg")
      : target;
    // already small enough and in the right format: hand it back untouched
    if (mode === "compress" && file.type === outType && file.size <= maxKb * KB) {
      return { blob: file, name: file.name, width: 0, height: 0, kept: true, fits: true };
    }
    const pic = await openImage(file, MAX_SIDE);
    try {
      const canvas = scaleTo(pic.source, pic.width, pic.height, pic.width, pic.height, outType === "image/jpeg" ? "#fff" : undefined);
      const name = withExtension(file.name, EXT[outType]);
      if (mode === "convert") {
        const blob = await encode(canvas, outType, outType === "image/png" ? undefined : quality);
        return { blob, name, width: canvas.width, height: canvas.height, fits: true };
      }
      const r = await compressCanvas(canvas, outType, { maxBytes: maxKb * KB });
      canvas.width = 0;
      return { blob: r.blob, name, width: r.width, height: r.height, fits: r.fits };
    } finally {
      pic.close();
    }
  }

  async function run() {
    const todo = items.filter((i) => !i.out);
    setProgress({ done: 0, total: todo.length });
    for (let n = 0; n < todo.length; n++) {
      const it = todo[n];
      let patch: Partial<Item>;
      try { patch = { out: await processOne(it.file), error: undefined }; }
      catch (e) { patch = { error: errorText(e) }; }
      setItems((list) => list.map((i) => (i.id === it.id ? { ...i, ...patch } : i)));
      setProgress({ done: n + 1, total: todo.length });
    }
    setProgress(null);
  }

  async function downloadAll() {
    const zip = await zipFiles(finished.map((i) => ({ name: i.out!.name, blob: i.out!.blob })));
    saveBlob(zip, mode === "compress" ? "compressed-images.zip" : "converted-images.zip");
  }

  const pending = items.filter((i) => !i.out && !i.error).length;
  const busy = progress !== null;

  return (
    <div className="grid gap-5">
      {mode === "compress" ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-2">
            <Segmented label="Make each image at most" value={kb} onChange={(v) => { setKb(v); resetResults(); }}
              options={[...SIZES.map((s) => ({ value: s as number | "custom", label: `${s} KB` })), { value: "custom", label: "Other" }]} />
            {kb === "custom" && (
              <Field label="Size limit (KB)" hint={badKb ? <span className="text-danger">Type a number from 5 to 50000.</span> : undefined}>
                <input className={inputClass + " max-w-40"} inputMode="numeric" value={customKb} onChange={(e) => { setCustomKb(e.target.value); resetResults(); }} />
              </Field>
            )}
          </div>
          <Segmented label="Save as" value={target} onChange={(v) => { setTarget(v); resetResults(); }}
            options={[{ value: "image/jpeg", label: "JPG" }, { value: "image/webp", label: "WebP" }, { value: "keep", label: "Same as now", title: "PNG stays PNG; anything else becomes JPG" }]} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-8">
          <Segmented label="Convert to" value={format} onChange={(v) => { setFormat(v); resetResults(); }}
            options={[{ value: "image/jpeg", label: "JPG" }, { value: "image/png", label: "PNG" }, { value: "image/webp", label: "WebP" }]} />
          {format !== "image/png" && (
            <label className="grid max-w-sm gap-1.5">
              <span className="flex justify-between text-[.88rem] font-semibold text-muted">Quality <span className="mono">{Math.round(quality * 100)}%</span></span>
              <input type="range" min={0.5} max={1} step={0.01} value={quality} onChange={(e) => { setQuality(Number(e.target.value)); resetResults(); }} className="w-full accent-route" />
            </label>
          )}
        </div>
      )}

      <DropZone accept="image/*" multiple paste onFiles={add} compact={items.length > 0}
        title={items.length ? "Add more images" : "Choose images"} hint={items.length ? undefined : "JPG, PNG, WebP or GIF; HEIC in Safari. Paste a screenshot with Ctrl+V."} />
      <GuestLimitNote dropped={dropped} />

      {items.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((it, i) => (
            <FileRow key={it.id} name={it.out?.name ?? it.file.name} size={it.file.size} thumb={it.thumb} index={i} count={items.length}
              error={it.error} onRemove={busy ? undefined : () => remove(it.id)}
              meta={it.out && (it.out.kept
                ? <span className="text-done">Already under {maxKb} KB, kept as it is</span>
                : <><SizeChange before={it.file.size} after={it.out.blob.size} />{it.out.width > 0 && <span>· {it.out.width}×{it.out.height}</span>}</>)}>
              {it.out && !it.out.fits && <span className="text-[.84rem] text-warm">Couldn’t get it under {maxKb} KB without making it unreadable.</span>}
              {it.out && (
                <button type="button" onClick={() => saveBlob(it.out!.blob, it.out!.name)}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-[.9rem] font-semibold text-route hover:underline">
                  <DownloadIcon /> Download
                </button>
              )}
            </FileRow>
          ))}
        </ul>
      )}

      {busy && <Progress done={progress.done} total={progress.total} label={`${mode === "compress" ? "Compressing" : "Converting"} ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`} />}

      {items.length > 0 && !busy && (
        <div className="flex flex-wrap items-center gap-3">
          {pending > 0 && (
            <button type="button" className="btn big" onClick={run} disabled={badKb}>
              {mode === "compress" ? `Compress ${pending} image${pending === 1 ? "" : "s"}` : `Convert ${pending} image${pending === 1 ? "" : "s"}`}
            </button>
          )}
          {finished.length > 1 && (
            <button type="button" className="btn primary !min-h-[50px] !px-6" onClick={downloadAll}>
              <DownloadIcon /> Download all ({finished.length}) as zip
            </button>
          )}
          <span className="text-[.88rem] text-muted">
            {finished.length > 0 && `Total ${formatBytes(finished.reduce((n, i) => n + i.out!.blob.size, 0))}`}
          </span>
        </div>
      )}
      {mode === "convert" && format === "image/jpeg" && items.some((i) => i.file.type === "image/png") && !finished.length && (
        <Notice>JPG can’t be see-through, so transparent areas will turn white.</Notice>
      )}
    </div>
  );
}
