import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { extractText } from "unpdf";
import {
  addPageNumbers, imagePageLayout, imagesToPdf, LockedPdfError, mergePdfs, openPdf, pageCount, pageLabel,
  pdfFromPageImages, pickPages, placeLabel, splitPdf,
} from "./pdfOps.ts";

/** A PDF whose pages say the given words, so tests can read back which page ended up where. */
async function pdfOf(...words: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const w of words) doc.addPage([400, 600]).drawText(w, { x: 50, y: 300, size: 24, font });
  return doc.save();
}

async function textOf(bytes: Uint8Array): Promise<string[]> {
  return (await extractText(new Uint8Array(bytes))).text.map((t) => t.replace(/\s+/g, " ").trim());
}

// a 1×1 PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

test("merge keeps every page, in the order the files were given", async () => {
  const merged = await mergePdfs([{ bytes: await pdfOf("Alpha", "Beta") }, { bytes: await pdfOf("Gamma") }]);
  assert.deepEqual(await textOf(merged), ["Alpha", "Beta", "Gamma"]);
});

test("pick pages in a chosen order; split into separate files", async () => {
  const src = await pdfOf("One", "Two", "Three", "Four");
  assert.deepEqual(await textOf(await pickPages(src, [3, 1])), ["Three", "One"]);
  const parts = await splitPdf(src, [[1, 2], [4]]);
  assert.equal(parts.length, 2);
  assert.deepEqual(await textOf(parts[0]), ["One", "Two"]);
  assert.deepEqual(await textOf(parts[1]), ["Four"]);
  assert.equal(await pageCount(src), 4);
});

test("page numbers: labels, start number and a skipped cover", async () => {
  const src = await pdfOf("Cover", "Intro", "Body");
  const out = await addPageNumbers(src, { style: "page-n-of-total", spot: "bottom-center", start: 1, fontSize: 11, skipFirst: true });
  const pages = await textOf(out);
  assert.equal(pages[0], "Cover");
  assert.match(pages[1], /Page 1 of 2/);
  assert.match(pages[2], /Page 2 of 2/);

  const from5 = await textOf(await addPageNumbers(src, { style: "n", spot: "top-right", start: 5, fontSize: 11, skipFirst: false }));
  assert.match(from5[0], /\b5\b/);
  assert.match(from5[2], /\b7\b/);
});

test("page labels", () => {
  assert.equal(pageLabel("n", 3, 9), "3");
  assert.equal(pageLabel("page-n", 3, 9), "Page 3");
  assert.equal(pageLabel("n-of-total", 3, 9), "3 / 9");
  assert.equal(pageLabel("page-n-of-total", 3, 9), "Page 3 of 9");
});

test("labels land where the page is seen, even on rotated pages", () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };
  assert.deepEqual(placeLabel("bottom-center", box, 0, 20, 10, 30), { x: 290, y: 30, rotate: 0 });
  assert.deepEqual(placeLabel("bottom-right", box, 0, 20, 10, 30), { x: 550, y: 30, rotate: 0 });
  // stored at 90°: shown 800 wide and 600 tall; the bottom edge as seen is the page's right edge
  assert.deepEqual(placeLabel("bottom-center", box, 90, 20, 10, 30), { x: 570, y: 390, rotate: 90 });
  assert.deepEqual(placeLabel("bottom-center", box, 180, 20, 10, 30), { x: 310, y: 770, rotate: 180 });
  assert.deepEqual(placeLabel("bottom-center", box, 270, 20, 10, 30), { x: 30, y: 410, rotate: 270 });
  assert.deepEqual(placeLabel("bottom-left", { x: 10, y: 20, width: 600, height: 800 }, -90, 20, 10, 30), { x: 40, y: 790, rotate: 270 });
});

test("page numbers read upright on a rotated page", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]).setRotation(degrees(90));
  const out = await addPageNumbers(await doc.save(), { style: "page-n", spot: "bottom-center", start: 1, fontSize: 12, skipFirst: false });
  assert.match((await textOf(out))[0], /Page 1/);
});

test("image page layout", () => {
  // a wide photo on A4 with auto orientation turns the page sideways
  const wide = imagePageLayout(4000, 3000, { size: "a4", orientation: "auto", margin: 20 });
  assert.ok(wide.pageW > wide.pageH);
  assert.ok(Math.abs(wide.w / wide.h - 4 / 3) < 1e-9, "keeps the photo's shape");
  assert.ok(wide.x >= 20 && wide.y >= 20 && wide.x + wide.w <= wide.pageW - 19.99 && wide.y + wide.h <= wide.pageH - 19.99);
  // forced portrait
  assert.ok(imagePageLayout(4000, 3000, { size: "a4", orientation: "portrait", margin: 0 }).pageH > 800);
  // a small signature isn't blown up to fill the page
  const small = imagePageLayout(300, 80, { size: "a4", orientation: "auto", margin: 20 });
  assert.equal(small.w, 225);
  // fit: the page is the image plus margins
  assert.deepEqual(imagePageLayout(960, 480, { size: "fit", orientation: "auto", margin: 10 }), { pageW: 740, pageH: 380, x: 10, y: 10, w: 720, h: 360 });
});

test("images become one page each", async () => {
  const pdf = await imagesToPdf(
    [{ bytes: PNG, kind: "png", width: 1, height: 1 }, { bytes: PNG, kind: "png", width: 1, height: 1 }],
    { size: "letter", orientation: "portrait", margin: 36 },
  );
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 2);
  assert.deepEqual(doc.getPage(0).getSize(), { width: 612, height: 792 });
});

test("rasterised pages keep their size", async () => {
  // pdf-lib only needs a JPEG header to embed it; this is the smallest valid baseline JPEG (1×1)
  const jpg = Uint8Array.from(Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64"));
  const doc = await PDFDocument.load(await pdfFromPageImages([{ jpg, width: 595, height: 842 }]));
  assert.deepEqual(doc.getPage(0).getSize(), { width: 595, height: 842 });
});

test("locked and broken files get a clear message", async () => {
  const locked = new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n" +
    "5 0 obj << /Filter /Standard /V 1 /R 2 /O (x) /U (x) /P -4 >> endobj\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>\n%%EOF");
  await assert.rejects(openPdf(locked, "marks.pdf"), (e: Error) => e instanceof LockedPdfError && /“marks\.pdf” is password-protected/.test(e.message));
  await assert.rejects(openPdf(new TextEncoder().encode("not a pdf"), "x.pdf"), /isn’t a PDF we can read/);
});
