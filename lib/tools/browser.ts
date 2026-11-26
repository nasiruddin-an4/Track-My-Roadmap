/*
 * Browser-only helpers for the student tools: open images, draw and encode them, render PDF pages, and save
 * files. Everything happens on the student's own device; nothing here sends a file anywhere.
 * Heavy libraries (PDF.js, the zip writer) load on first use, so tool pages stay light.
 */
import { fitToSize, type FitOptions } from "./fitSize";
import { LockedPdfError } from "./errors";
import { uniqueNames } from "./files";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function readBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Bytes as a Blob (pdf-lib and fflate hand back typed arrays). */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
}

export class UnreadableImageError extends Error {
  constructor(name: string) {
    super(/\.hei[cf]$/i.test(name)
      ? `This browser can’t open “${name}” (an iPhone HEIC photo). Open this page in Safari, or set the iPhone camera to “Most Compatible” (Settings → Camera → Formats).`
      : `“${name}” isn’t an image this browser can open. Try a JPG or PNG.`);
    this.name = "UnreadableImageError";
  }
}

export class UnsupportedFormatError extends Error {
  constructor(type: ImageType) {
    super(`This browser can’t save ${EXT[type].toUpperCase()} files. Choose JPG or PNG, or use Chrome.`);
    this.name = "UnsupportedFormatError";
  }
}

export type Picture = { source: CanvasImageSource; width: number; height: number; close: () => void };

/**
 * Opens an image the browser can show (JPG, PNG, WebP, GIF, and HEIC in Safari), the right way up (phone photos
 * store their rotation separately), shrunk so its longest side is at most `maxSide` when given.
 */
export async function openImage(file: File, maxSide = 0): Promise<Picture> {
  let pic: Picture;
  try {
    const bmp = await createImageBitmap(file);
    pic = { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    pic = await viaImgElement(file);
  }
  const long = Math.max(pic.width, pic.height);
  if (!maxSide || long <= maxSide) return pic;
  const k = maxSide / long;
  const c = scaleTo(pic.source, pic.width, pic.height, Math.round(pic.width * k), Math.round(pic.height * k));
  pic.close();
  return { source: c, width: c.width, height: c.height, close: () => { c.width = 0; } };
}

async function viaImgElement(file: File): Promise<Picture> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new UnreadableImageError(file.name);
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

export function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Your browser ran out of memory for this image. Close other tabs and try again.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

/**
 * Draws `source` at `dw`×`dh`. Big reductions go in halving steps, which keeps fine lines (text, signatures)
 * smooth instead of jagged. `background` fills transparent areas (JPEG has no transparency).
 */
export function scaleTo(source: CanvasImageSource, sw: number, sh: number, dw: number, dh: number, background?: string): HTMLCanvasElement {
  let src = source, w = sw, h = sh;
  while (w / 2 >= dw && h / 2 >= dh && w > 2 && h > 2) {
    const step = newCanvas(w / 2, h / 2);
    ctx2d(step).drawImage(src, 0, 0, w, h, 0, 0, step.width, step.height);
    if (src instanceof HTMLCanvasElement && src !== source) src.width = 0;
    src = step; w = step.width; h = step.height;
  }
  const out = newCanvas(dw, dh);
  const ctx = ctx2d(out);
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, out.width, out.height); }
  ctx.drawImage(src, 0, 0, w, h, 0, 0, out.width, out.height);
  if (src instanceof HTMLCanvasElement && src !== source) src.width = 0;
  return out;
}

export function encode(canvas: HTMLCanvasElement, type: ImageType, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) reject(new Error("Your browser couldn’t save this image. It may be too large; try a smaller one."));
      // Safari quietly saves PNG when asked for WebP
      else if (b.type !== type) reject(new UnsupportedFormatError(type));
      else resolve(b);
    }, type, quality);
  });
}

export type Compressed = { blob: Blob; width: number; height: number; quality: number; fits: boolean };

/** Encodes a canvas as small as the limits ask, keeping as much quality as possible (see fitToSize). */
export async function compressCanvas(canvas: HTMLCanvasElement, type: ImageType, o: FitOptions = {}): Promise<Compressed> {
  const sizes = new Map<number, HTMLCanvasElement>([[1, canvas]]);
  const at = (s: number) => {
    let c = sizes.get(s);
    if (!c) {
      c = scaleTo(canvas, canvas.width, canvas.height, canvas.width * s, canvas.height * s, type === "image/png" ? undefined : "#fff");
      sizes.set(s, c);
    }
    return c;
  };
  const r = await fitToSize((q, s) => encode(at(s), type, q), { lossy: type !== "image/png", ...o });
  const c = at(r.scale);
  const out = { blob: r.out, width: c.width, height: c.height, quality: r.quality, fits: r.fits };
  sizes.forEach((x) => { if (x !== canvas && x !== c) x.width = 0; });
  return out;
}

/** Saves a file to the device (the browser's Downloads). */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** One .zip of several files. Images and PDFs are already compressed, so they're stored as they are (fast). */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const names = uniqueNames(files.map((f) => f.name));
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (let i = 0; i < files.length; i++) entries[names[i]] = [await readBytes(files[i].blob), { level: 0 }];
  return bytesToBlob(zipSync(entries), "application/zip");
}

export type RenderablePdf = Awaited<ReturnType<typeof import("unpdf")["getDocumentProxy"]>>;

/** Opens a PDF for drawing its pages (PDF.js). Owner-locked PDFs open fine; ones that need a password don't. */
export async function openPdfForRender(bytes: Uint8Array, name?: string): Promise<RenderablePdf> {
  const { getDocumentProxy } = await import("unpdf");
  try {
    // a copy: PDF.js may take ownership of the buffer it's given
    return await getDocumentProxy(bytes.slice());
  } catch (e) {
    if ((e as { name?: string })?.name === "PasswordException") throw new LockedPdfError(name);
    throw new Error(`${name ? `“${name}”` : "This file"} isn’t a PDF we can read. It may be damaged; try opening and saving it again.`);
  }
}

/** Phones refuse canvases much over about 16 megapixels. */
const MAX_PIXELS = 16_000_000;

/** Draws one page (counted from 1) on a white canvas at `scale` (1 = 72 dpi). Also returns the page size in points. */
export async function renderPdfPage(pdf: RenderablePdf, n: number, scale: number) {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const fit = Math.min(scale, Math.sqrt(MAX_PIXELS / (base.width * base.height)));
  const viewport = page.getViewport({ scale: fit });
  const canvas = newCanvas(viewport.width, viewport.height);
  // annotationMode 1: draw filled-in form fields and stamps too, not just the page
  await page.render({ canvas, viewport, annotationMode: 1 }).promise;
  page.cleanup();
  return { canvas, widthPt: base.width, heightPt: base.height };
}
