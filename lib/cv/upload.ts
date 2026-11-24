/*
 * Checking an uploaded CV file and tidying what the AI read from it. Pure functions (zod is the only import), so
 * the unit tests run this file directly with `node --test`.
 */
import { z } from "zod";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** More text than this isn't a CV (about 20 dense pages); it's refused rather than cut short. */
export const MAX_CV_CHARS = 60_000;
/** Unzipped size allowed for a DOCX: real CVs are well under 10 MB; more is a zip bomb. */
const MAX_DOCX_UNZIPPED = 40 * 1024 * 1024;

export type FileKind = "pdf" | "docx";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MIME_OF: Record<FileKind, string> = { pdf: "application/pdf", docx: DOCX_MIME };

// browsers and phones sometimes send no type, or a generic one, for perfectly good files
const LOOSE = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const PDF_TYPES = new Set(["application/pdf", "application/x-pdf", ...LOOSE]);
const DOCX_TYPES = new Set([DOCX_MIME, "application/zip", "application/x-zip-compressed", ...LOOSE]);

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/**
 * What the file really is, judged by its name, its declared type and its first bytes, all three of which must agree.
 * Null for anything else (including an old .doc, an image, or a renamed file).
 */
export function sniffKind(bytes: Uint8Array, name: string, mime: string): FileKind | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const type = mime.toLowerCase().split(";")[0].trim();
  if (ext === "pdf" && PDF_TYPES.has(type) && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (ext === "docx" && DOCX_TYPES.has(type) && startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const zip = inspectZip(bytes);
    if (zip && zip.entries.includes("word/document.xml") && zip.unzippedBytes <= MAX_DOCX_UNZIPPED) return "docx";
  }
  return null;
}

/** Entry names and total unzipped size, read from a zip's central directory. Null if it isn't a readable zip. */
export function inspectZip(b: Uint8Array): { entries: string[]; unzippedBytes: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // the end-of-central-directory record sits in the last 22 bytes + up to 64 KB of comment
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  if (count > 5000 || p >= b.length) return null;
  const entries: string[] = [];
  let unzippedBytes = 0;
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) return null;
    unzippedBytes += dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    entries.push(dec.decode(b.subarray(p + 46, p + 46 + nameLen)));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, unzippedBytes };
}

/** A PDF that's really a photo or scan has almost no text to read. */
export function looksScanned(text: string): boolean {
  return (text.match(/\p{L}/gu) ?? []).length < 150;
}

/* ---------- what the AI is asked to fill in ---------- */

// Every field is required so the model always returns the full shape; it uses "" or [] for anything the CV lacks.
const S = z.string();
export const extractionSchema = z.object({
  name: S, headline: S, email: S, phone: S, city: S, country: S, website: S,
  profiles: z.array(z.object({ network: S, url: S })),
  summary: S,
  work: z.array(z.object({ company: S, position: S, location: S, startDate: S, endDate: S, current: z.boolean(), highlights: z.array(S) })),
  education: z.array(z.object({ institution: S, degree: S, field: S, startDate: S, endDate: S, result: S })),
  skills: z.array(z.object({ group: S, items: z.array(S) })),
  projects: z.array(z.object({ name: S, description: S, url: S, highlights: z.array(S) })),
  certificates: z.array(z.object({ name: S, issuer: S, date: S, url: S })),
  languages: z.array(z.object({ language: S, fluency: S })),
});
export type Extraction = z.infer<typeof extractionSchema>;

/* ---------- tidying the reply into CV content ---------- */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ONGOING = /\b(present|current|currently|now|ongoing|today|till date|to date)\b/i;

/** Any common way of writing a month and year, as "YYYY-MM" or "YYYY". Empty when there's no real date. */
export function normalizeDate(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || ONGOING.test(s)) return "";
  const mm = (n: number) => String(n).padStart(2, "0");
  let m = /^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${mm(+m[2])}`;
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${mm(+m[1])}`;
  m = /([a-z]{3,})\.?,?\s*'?(\d{4})/.exec(s);
  if (m) {
    const i = MONTHS.indexOf(m[1].slice(0, 3));
    if (i >= 0) return `${m[2]}-${mm(i + 1)}`;
  }
  m = /\b(19[5-9]\d|20\d{2})\b/.exec(s);
  return m ? m[1] : "";
}

// the same pattern zod uses for z.email(), so a cleaned email always passes the schema
const EMAIL = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

const cut = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const bullet = (s: string) => cut(s.replace(/^\s*(?:[•●▪◦‣\-*–—]\s*)+/, ""), 400);
const list = <T>(a: T[] | undefined, max: number) => (a ?? []).slice(0, max);

/** The AI's reply as CV content that fits the limits in lib/cv/schema.ts. Entries with nothing useful are dropped. */
export function toCvData(x: Extraction) {
  const email = cut(x.email, 200);
  return {
    basics: {
      name: cut(x.name, 100),
      label: cut(x.headline, 120),
      email: EMAIL.test(email) ? email : "",
      phone: cut(x.phone, 40),
      location: { city: cut(x.city, 80), country: cut(x.country, 80) },
      url: cut(x.website, 300),
      profiles: list(x.profiles.filter((p) => p.url.trim()), 8).map((p) => ({ network: cut(p.network, 40), url: cut(p.url, 300) })),
      summary: cut(x.summary, 1500),
    },
    work: list(x.work.filter((w) => w.position.trim() || w.company.trim()), 20).map((w) => ({
      name: cut(w.company, 120), position: cut(w.position, 120), location: cut(w.location, 120),
      startDate: normalizeDate(w.startDate),
      endDate: w.current ? "" : normalizeDate(w.endDate),
      highlights: list(w.highlights.map(bullet).filter(Boolean), 15),
    })),
    education: list(x.education.filter((e) => e.institution.trim()), 10).map((e) => ({
      institution: cut(e.institution, 160), studyType: cut(e.degree, 120), area: cut(e.field, 160),
      startDate: normalizeDate(e.startDate), endDate: normalizeDate(e.endDate), score: cut(e.result, 40),
    })),
    skills: list(x.skills.filter((g) => g.items.some((i) => i.trim()) || g.group.trim()), 20).map((g) => ({
      name: cut(g.group, 80),
      keywords: list([...new Set(g.items.map((i) => cut(i, 60)).filter(Boolean))], 40),
      source: "user" as const,
    })),
    projects: list(x.projects.filter((p) => p.name.trim()), 20).map((p) => ({
      name: cut(p.name, 120), description: cut(p.description, 600), url: cut(p.url, 300),
      highlights: list(p.highlights.map(bullet).filter(Boolean), 15),
    })),
    certificates: list(x.certificates.filter((c) => c.name.trim()), 30).map((c) => ({
      name: cut(c.name, 160), issuer: cut(c.issuer, 120), date: normalizeDate(c.date), url: cut(c.url, 300), source: "user" as const,
    })),
    languages: list(x.languages.filter((l) => l.language.trim()), 15).map((l) => ({ language: cut(l.language, 60), fluency: cut(l.fluency, 60) })),
    sectionOrder: ["summary", "skills", "work", "projects", "education", "certificates", "languages"],
  };
}
