import assert from "node:assert/strict";
import { test } from "node:test";
import { asciiDigits, formatBytes, pagesOf, parsePageRanges, rangeLabel, uniqueNames, withExtension } from "./files.ts";

test("sizes read the way forms state them", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(100 * 1024), "100 KB");
  assert.equal(formatBytes(1536 * 1024), "1.5 MB");
  assert.equal(formatBytes(25 * 1024 * 1024), "25 MB");
});

test("file names", () => {
  assert.equal(withExtension("IMG_2041.HEIC", "jpg"), "IMG_2041.jpg");
  assert.equal(withExtension("notes", "pdf"), "notes.pdf");
  assert.equal(withExtension(".png", "jpg"), "file.jpg");
  assert.deepEqual(uniqueNames(["a.jpg", "b.jpg", "A.jpg", "a.jpg"]), ["a.jpg", "b.jpg", "A (2).jpg", "a (3).jpg"]);
});

test("page ranges", () => {
  const ok = parsePageRanges("1-3, 5, 8-", 10);
  assert.deepEqual(ok, { ok: true, ranges: [{ from: 1, to: 3 }, { from: 5, to: 5 }, { from: 8, to: 10 }] });
  assert.deepEqual(parsePageRanges("3,1 ; 2", 3), { ok: true, ranges: [{ from: 3, to: 3 }, { from: 1, to: 1 }, { from: 2, to: 2 }] });
  assert.deepEqual(parsePageRanges("২–৪", 5), { ok: true, ranges: [{ from: 2, to: 4 }] });
  assert.deepEqual(parsePageRanges("2 to 4", 5), { ok: true, ranges: [{ from: 2, to: 4 }] });
});

test("page range mistakes get a clear message", () => {
  const msg = (s: string, n = 10) => { const r = parsePageRanges(s, n); return r.ok ? "" : r.error; };
  assert.match(msg(""), /Type the pages/);
  assert.match(msg("12", 10), /Page 12 doesn’t exist\. This PDF has 10 pages/);
  assert.match(msg("2", 1), /has 1 page\./);
  assert.match(msg("0"), /start at 1/);
  assert.match(msg("5-2"), /Did you mean 2-5/);
  assert.match(msg("a-b"), /isn’t a page or a range/);
});

test("pages in a range and their labels", () => {
  assert.deepEqual(pagesOf({ from: 2, to: 4 }), [2, 3, 4]);
  assert.equal(rangeLabel({ from: 2, to: 4 }), "pages-2-4");
  assert.equal(rangeLabel({ from: 7, to: 7 }), "page-7");
  assert.equal(asciiDigits("পৃষ্ঠা ১২"), "পৃষ্ঠা 12");
});
