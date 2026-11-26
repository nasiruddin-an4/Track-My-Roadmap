/*
 * CV content, in the JSON Resume shape (https://jsonresume.org/schema) plus a few fields of our own:
 * `source` on skills and certificates (where an entry came from) and `sectionOrder`.
 *
 * Every write goes through cvDataSchema on the server. Dates are "YYYY", "YYYY-MM" or "YYYY-MM-DD";
 * a work entry with a start date and no end date is shown as "Present".
 *
 * Keep this file free of local imports: the unit tests run it directly with `node --test`.
 */
import { z } from "zod";

export const SECTION_KEYS = ["summary", "skills", "work", "projects", "education", "certificates", "languages"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => z.string().trim().max(max).optional();
const date = z.string().trim().regex(/^(\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?)?$/, "Use YYYY or YYYY-MM").optional();
const bullets = z.array(text(400)).max(15);

const basics = z.object({
  name: text(100),
  label: optText(120),
  // empty is allowed so a half-finished CV can still be saved; the ATS check flags a missing email
  email: z.union([z.literal(""), z.email("Enter a valid email").max(200)]),
  phone: optText(40),
  location: z.object({ city: optText(80), country: optText(80) }).optional(),
  url: optText(300),
  profiles: z.array(z.object({ network: text(40), url: text(300) })).max(8).optional(),
  summary: optText(1500),
});

const work = z.object({
  name: text(120),
  position: text(120),
  location: optText(120),
  startDate: z.string().trim().regex(/^(\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?)?$/, "Use YYYY or YYYY-MM"),
  endDate: date,
  highlights: bullets,
});

const education = z.object({
  institution: text(160),
  area: optText(160),
  studyType: optText(120),
  startDate: date,
  endDate: date,
  score: optText(40),
});

const skill = z.object({
  name: text(80),
  keywords: z.array(text(60)).max(40),
  source: z.enum(["user", "roadmap"]).optional(),
});

const project = z.object({
  name: text(120),
  description: optText(600),
  highlights: bullets.optional(),
  url: optText(300),
});

const certificate = z.object({
  name: text(160),
  issuer: text(120),
  date,
  url: optText(300),
  source: z.enum(["user", "trackmyroadmap"]).optional(),
});

const language = z.object({ language: text(60), fluency: optText(60) });

/** Any order the person picked, then any section they left out, so every section has a place. */
const sectionOrder = z.array(z.enum(SECTION_KEYS)).max(SECTION_KEYS.length * 2).transform((list) => {
  const seen = new Set<SectionKey>();
  const out: SectionKey[] = [];
  for (const k of [...list, ...SECTION_KEYS]) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
});

/** The language the CV is written in: section names, months and digits follow it. English when left out. */
export const CV_LOCALES = ["en", "bn"] as const;
export type CvLocale = (typeof CV_LOCALES)[number];

export const cvDataSchema = z.object({
  locale: z.enum(CV_LOCALES).optional(),
  basics,
  work: z.array(work).max(20),
  education: z.array(education).max(10),
  skills: z.array(skill).max(20),
  projects: z.array(project).max(20),
  certificates: z.array(certificate).max(30),
  languages: z.array(language).max(15).optional(),
  sectionOrder,
});

export type CvData = z.output<typeof cvDataSchema>;
export type CvWork = CvData["work"][number];
export type CvEducation = CvData["education"][number];
export type CvSkill = CvData["skills"][number];
export type CvProject = CvData["projects"][number];
export type CvCertificate = CvData["certificates"][number];
export type CvLanguage = NonNullable<CvData["languages"]>[number];

export const DEFAULT_ORDER: SectionKey[] = ["summary", "skills", "work", "projects", "education", "certificates", "languages"];

export function emptyCv(basics: { name?: string; email?: string; label?: string } = {}): CvData {
  return {
    basics: { name: basics.name ?? "", email: basics.email ?? "", label: basics.label ?? "" },
    work: [], education: [], skills: [], projects: [], certificates: [], languages: [],
    sectionOrder: [...DEFAULT_ORDER],
  };
}

/** Validate CV content before saving it. */
export function parseCvData(raw: unknown): { ok: true; data: CvData } | { ok: false; error: string } {
  const r = cvDataSchema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  return { ok: false, error: first ? `${first.path.join(".") || "CV"}: ${first.message}` : "The CV isn’t valid." };
}

/** Content read back from the database. Rows are validated on write, so this only guards against hand edits. */
export function readCvData(raw: unknown): CvData {
  const r = cvDataSchema.safeParse(raw);
  return r.success ? r.data : emptyCv();
}

/* ---------- the rest of a CV row ---------- */

export const PAGE_SIZES = ["a4", "letter"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const cvCreateSchema = z.object({
  title: text(80).min(1).optional(),
  pageSize: z.enum(PAGE_SIZES).optional(),
  data: cvDataSchema.optional(),
});

export const cvPatchSchema = z.object({
  title: text(80).min(1).optional(),
  pageSize: z.enum(PAGE_SIZES).optional(),
  data: cvDataSchema.optional(),
}).refine((p) => p.title !== undefined || p.pageSize !== undefined || p.data !== undefined, "Nothing to save");
