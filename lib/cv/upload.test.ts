import assert from "node:assert/strict";
import { test } from "node:test";
import { cvDataSchema } from "./schema.ts";
import { DOCX_MIME, inspectZip, looksScanned, normalizeDate, sniffKind, toCvData, type Extraction } from "./upload.ts";

/** A minimal zip (stored, no compression). `claim` overrides the unzipped size written in the directory. */
function makeZip(files: { name: string; data?: string; claim?: number }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: number[] = [], central: number[] = [];
  const u16 = (a: number[], v: number) => a.push(v & 255, (v >> 8) & 255);
  const u32 = (a: number[], v: number) => a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.data ?? "x"), at = parts.length;
    u32(parts, 0x04034b50); u16(parts, 20); u16(parts, 0); u16(parts, 0); u16(parts, 0); u16(parts, 0);
    u32(parts, 0); u32(parts, data.length); u32(parts, data.length); u16(parts, name.length); u16(parts, 0);
    parts.push(...name, ...data);
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, 0); u16(central, 0); u16(central, 0); u16(central, 0);
    u32(central, 0); u32(central, data.length); u32(central, f.claim ?? data.length);
    u16(central, name.length); u16(central, 0); u16(central, 0); u16(central, 0); u16(central, 0); u32(central, 0); u32(central, at);
    central.push(...name);
  }
  const end: number[] = [];
  u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, files.length); u16(end, files.length);
  u32(end, central.length); u32(end, parts.length); u16(end, 0);
  return new Uint8Array([...parts, ...central, ...end]);
}

const pdfBytes = new TextEncoder().encode("%PDF-1.7\n%…rest of a pdf");
const docx = makeZip([{ name: "[Content_Types].xml" }, { name: "word/document.xml", data: "<w:document/>" }]);

test("a real PDF is accepted, judged by its first bytes", () => {
  assert.equal(sniffKind(pdfBytes, "CV.pdf", "application/pdf"), "pdf");
  assert.equal(sniffKind(pdfBytes, "cv.PDF", ""), "pdf"); // some phones send no type
  assert.equal(sniffKind(new TextEncoder().encode("<html>"), "cv.pdf", "application/pdf"), null); // renamed file
  assert.equal(sniffKind(pdfBytes, "cv.png", "image/png"), null);
  assert.equal(sniffKind(pdfBytes, "cv.pdf", "text/html"), null); // the type says it's something else
});

test("a real DOCX is accepted; other zips and old .doc files are not", () => {
  assert.equal(sniffKind(docx, "cv.docx", DOCX_MIME), "docx");
  assert.equal(sniffKind(docx, "cv.docx", "application/octet-stream"), "docx");
  const notWord = makeZip([{ name: "photo.jpg" }]);
  assert.equal(sniffKind(notWord, "cv.docx", DOCX_MIME), null);
  assert.equal(sniffKind(pdfBytes, "cv.docx", DOCX_MIME), null);
  assert.equal(sniffKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "cv.doc", "application/msword"), null);
});

test("a zip bomb dressed as a DOCX is refused", () => {
  const bomb = makeZip([{ name: "word/document.xml", claim: 4_000_000_000 }]);
  assert.equal(inspectZip(bomb)?.unzippedBytes, 4_000_000_000);
  assert.equal(sniffKind(bomb, "cv.docx", DOCX_MIME), null);
  assert.equal(inspectZip(new Uint8Array([1, 2, 3])), null);
});

test("a PDF with almost no text counts as scanned", () => {
  assert.equal(looksScanned(""), true);
  assert.equal(looksScanned("Page 1\n\n Page 2 "), true);
  assert.equal(looksScanned("Jane Doe, Frontend Developer. ".repeat(10)), false);
  assert.equal(looksScanned("জেন ডো, ফ্রন্টএন্ড ডেভেলপার। ".repeat(10)), false); // letters in any script count
});

test("dates in any common style become YYYY-MM or YYYY", () => {
  const cases: [string, string][] = [
    ["2023-05", "2023-05"], ["2023-5", "2023-05"], ["2023/05/14", "2023-05"], ["05/2023", "2023-05"], ["5.2023", "2023-05"],
    ["May 2023", "2023-05"], ["Sept. 2021", "2021-09"], ["january, 2020", "2020-01"], ["2019", "2019"], ["Summer 2018", "2018"],
    ["Present", ""], ["Current", ""], ["", ""], ["13/2023", "2023"], ["soon", ""],
  ];
  for (const [input, want] of cases) assert.equal(normalizeDate(input), want, input);
});

const blank = (): Extraction => ({
  name: "", headline: "", email: "", phone: "", city: "", country: "", website: "", profiles: [], summary: "",
  work: [], education: [], skills: [], projects: [], certificates: [], languages: [],
});

test("the AI's reply is tidied into a valid CV", () => {
  const x = blank();
  x.name = "  Jane   Doe ";
  x.email = "jane@example.com";
  x.work = [
    { company: "Acme", position: "Developer", location: "", startDate: "March 2024", endDate: "Present", current: true, highlights: ["• Built it", "", "- Shipped it"] },
    { company: "", position: "", location: "", startDate: "", endDate: "", current: false, highlights: [] }, // nothing in it
  ];
  x.skills = [{ group: "", items: ["Go", "Go", " Rust "] }];
  x.profiles = [{ network: "GitHub", url: "github.com/jane" }, { network: "LinkedIn", url: "" }];
  const data = toCvData(x);
  assert.equal(data.basics.name, "Jane Doe");
  assert.deepEqual(data.work, [{ name: "Acme", position: "Developer", location: "", startDate: "2024-03", endDate: "", highlights: ["Built it", "Shipped it"] }]);
  assert.deepEqual(data.skills[0].keywords, ["Go", "Rust"]);
  assert.equal(data.basics.profiles.length, 1);
  assert.ok(cvDataSchema.safeParse(data).success);
});

test("a malformed email is dropped rather than failing the whole import", () => {
  const x = blank();
  x.email = "jane at example dot com";
  const data = toCvData(x);
  assert.equal(data.basics.email, "");
  assert.ok(cvDataSchema.safeParse(data).success);
});

test("overlong replies are cut to the CV's limits and still validate", () => {
  const x = blank();
  x.summary = "word ".repeat(1000);
  x.work = Array.from({ length: 30 }, (_, i) => ({ company: `Co ${i}`, position: "Dev", location: "", startDate: "2020", endDate: "2021", current: false,
    highlights: Array.from({ length: 20 }, () => "x".repeat(500)) }));
  const data = toCvData(x);
  assert.equal(data.work.length, 20);
  assert.equal(data.work[0].highlights.length, 15);
  assert.ok(cvDataSchema.safeParse(data).success);
});
