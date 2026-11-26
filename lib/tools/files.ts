/*
 * Small helpers for file names, sizes and page lists, shared by the student tools.
 * No runtime imports: the unit tests run this file directly.
 */

/** 84 KB, 1.2 MB. Forms in Bangladesh count 1 KB as 1,024 bytes, so this does too. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export const KB = 1024;

/** "photo.HEIC" → "photo.jpg". */
export function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "file";
  return `${base}.${ext}`;
}

/** Adds " (2)", " (3)"… so every file in a zip has its own name. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (!count) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${count + 1})${n.slice(dot)}` : `${n} (${count + 1})`;
  });
}

/** Bengali digits (১২৩) become 123, so "১-৩" works as a page range too. */
export function asciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
}

export type PageRange = { from: number; to: number };

/**
 * Reads page ranges like "1-3, 5, 8-" for a PDF with `pageCount` pages. Pages count from 1; "8-" means
 * page 8 to the end. Ranges keep the order they were typed in, so "3, 1, 2" reorders pages.
 */
export function parsePageRanges(input: string, pageCount: number): { ok: true; ranges: PageRange[] } | { ok: false; error: string } {
  const text = asciiDigits(input).replace(/[–—]|\bto\b/gi, "-").trim();
  if (!text) return { ok: false, error: "Type the pages you want, for example 1-3, 5." };
  const ranges: PageRange[] = [];
  for (const raw of text.split(/[,;]+/)) {
    const part = raw.replace(/\s+/g, "");
    if (!part) continue;
    const m = /^(\d+)(?:-(\d*))?$/.exec(part);
    if (!m) return { ok: false, error: `“${raw.trim()}” isn’t a page or a range. Use numbers like 2 or 4-7.` };
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : m[2] === "" ? pageCount : Number(m[2]);
    if (from < 1 || to < 1) return { ok: false, error: "Pages start at 1." };
    if (from > pageCount || to > pageCount) {
      return { ok: false, error: `Page ${Math.max(from, to)} doesn’t exist. This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.` };
    }
    if (from > to) return { ok: false, error: `In “${part}” the first page comes after the last. Did you mean ${to}-${from}?` };
    ranges.push({ from, to });
  }
  if (!ranges.length) return { ok: false, error: "Type the pages you want, for example 1-3, 5." };
  return { ok: true, ranges };
}

/** The pages a range covers, in order. */
export function pagesOf(r: PageRange): number[] {
  return Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i);
}

/** "pages 1-3" or "page 5", for file names. */
export function rangeLabel(r: PageRange): string {
  return r.from === r.to ? `page-${r.from}` : `pages-${r.from}-${r.to}`;
}
