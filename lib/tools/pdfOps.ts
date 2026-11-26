/*
 * PDF changes for the free tools: merge, pick or split pages, add page numbers, and build a PDF from images.
 * Built on pdf-lib, bytes in and bytes out, so the same code runs in the browser (people's files never
 * leave their device) and in the unit tests.
 */
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { LockedPdfError } from "./errors.ts";
import { pageLabel, type NumberStyle, type Spot } from "./pageLabels.ts";

export { LockedPdfError, pageLabel, type NumberStyle, type Spot };

const PRODUCER = "Track My Roadmap (trackmyroadmap.com/tools)";

/** Opens a PDF, turning pdf-lib's errors into ones anyone can act on. */
export async function openPdf(bytes: Uint8Array, name?: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(String((e as Error)?.message))) throw new LockedPdfError(name);
    throw new Error(`${name ? `“${name}”` : "This file"} isn’t a PDF we can read. It may be damaged; try opening and saving it again.`);
  }
}

function stamp(doc: PDFDocument) {
  doc.setProducer(PRODUCER);
  doc.setCreator(PRODUCER);
}

export async function pageCount(bytes: Uint8Array, name?: string): Promise<number> {
  return (await openPdf(bytes, name)).getPageCount();
}

/** One PDF from several, in the order given. */
export async function mergePdfs(files: { bytes: Uint8Array; name?: string }[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await openPdf(f.bytes, f.name);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  stamp(out);
  return out.save();
}

/** A new PDF with the given pages (counted from 1), in the given order. */
export async function pickPages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await openPdf(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p - 1));
  copied.forEach((p) => out.addPage(p));
  stamp(out);
  return out.save();
}

/** Several PDFs, one per group of pages. */
export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const src = await openPdf(bytes);
  const outs: Uint8Array[] = [];
  for (const pages of groups) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pages.map((p) => p - 1));
    copied.forEach((p) => out.addPage(p));
    stamp(out);
    outs.push(await out.save());
  }
  return outs;
}


/**
 * Where to draw a label so it sits at `spot` as the page is shown, and upright, even on pages stored rotated
 * (scans often are). Returns the point in the page's own coordinates and the rotation to draw the text with.
 */
export function placeLabel(
  spot: Spot,
  box: { x: number; y: number; width: number; height: number },
  rotation: number,
  textWidth: number,
  fontSize: number,
  margin: number,
): { x: number; y: number; rotate: number } {
  const r = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  const sideways = r === 90 || r === 270;
  const vw = sideways ? box.height : box.width;
  const vh = sideways ? box.width : box.height;
  const [v, h] = spot.split("-");
  const vx = h === "left" ? margin : h === "right" ? vw - margin - textWidth : (vw - textWidth) / 2;
  const vy = v === "top" ? vh - margin - fontSize * 0.72 : margin; // text baseline; capitals are about 0.72 em tall
  const [x, y] =
    r === 90 ? [box.width - vy, vx]
    : r === 180 ? [box.width - vx, box.height - vy]
    : r === 270 ? [vy, box.height - vx]
    : [vx, vy];
  return { x: box.x + x, y: box.y + y, rotate: r };
}

export type NumberOptions = {
  style: NumberStyle;
  spot: Spot;
  /** the number printed on the first numbered page */
  start: number;
  fontSize: number;
  /** leave the first page (a cover) without a number; numbering starts on page 2 */
  skipFirst: boolean;
};

export async function addPageNumbers(bytes: Uint8Array, o: NumberOptions): Promise<Uint8Array> {
  const doc = await openPdf(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const numbered = pages.length - (o.skipFirst ? 1 : 0);
  const total = o.start + numbered - 1;
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.start + i - (o.skipFirst ? 1 : 0);
    const text = pageLabel(o.style, n, total);
    const width = font.widthOfTextAtSize(text, o.fontSize);
    const box = page.getCropBox();
    const margin = Math.max(18, Math.min(box.width, box.height) * 0.045);
    const at = placeLabel(o.spot, box, page.getRotation().angle, width, o.fontSize, margin);
    page.drawText(text, { x: at.x, y: at.y, size: o.fontSize, font, color: rgb(0.13, 0.13, 0.13), rotate: degrees(at.rotate) });
  });
  stamp(doc);
  return doc.save();
}

export type PageSize = "a4" | "letter" | "fit";
export type Orientation = "auto" | "portrait" | "landscape";
export type LayoutOptions = { size: PageSize; orientation: Orientation; margin: number };

/** Page sizes in points (1/72 inch). */
export const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
/** An image is never enlarged past 96 dpi, so small pictures don't turn blurry on a big page. */
const PT_PER_PX = 72 / 96;

/** The page size for one image, and where on it the image goes (centred, as large as fits). */
export function imagePageLayout(imgW: number, imgH: number, o: LayoutOptions) {
  if (o.size === "fit") {
    const w = imgW * PT_PER_PX, h = imgH * PT_PER_PX;
    return { pageW: w + 2 * o.margin, pageH: h + 2 * o.margin, x: o.margin, y: o.margin, w, h };
  }
  const [a, b] = PAGE_SIZES[o.size];
  const landscape = o.orientation === "landscape" || (o.orientation === "auto" && imgW > imgH);
  const pageW = landscape ? b : a, pageH = landscape ? a : b;
  const boxW = pageW - 2 * o.margin, boxH = pageH - 2 * o.margin;
  const scale = Math.min(boxW / imgW, boxH / imgH, PT_PER_PX);
  const w = imgW * scale, h = imgH * scale;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

export type PdfImage = { bytes: Uint8Array; kind: "jpg" | "png"; width: number; height: number };

/** One page per image. */
export async function imagesToPdf(images: PdfImage[], o: LayoutOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.kind === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const at = imagePageLayout(img.width, img.height, o);
    const page = doc.addPage([at.pageW, at.pageH]);
    page.drawImage(embedded, { x: at.x, y: at.y, width: at.w, height: at.h });
  }
  stamp(doc);
  return doc.save();
}

/** A PDF whose pages are the given JPEGs, each filling a page of the given size in points (used to shrink scans). */
export async function pdfFromPageImages(pages: { jpg: Uint8Array; width: number; height: number }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpg);
    doc.addPage([p.width, p.height]).drawImage(img, { x: 0, y: 0, width: p.width, height: p.height });
  }
  stamp(doc);
  return doc.save();
}
