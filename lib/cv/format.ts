/*
 * How CV content is written out, shared by the on-screen preview and the PDF so both say exactly the same thing.
 * The rules follow what applicant tracking systems read reliably: standard section names, one date format
 * ("May 2023 – Present"), plain "•" bullets, contact details as plain text.
 *
 * Type-only imports here (no local runtime imports): the unit tests run this file directly with `node --test`.
 */
import type { CvData, SectionKey } from "./schema";

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  skills: "Skills",
  work: "Experience",
  projects: "Projects",
  education: "Education",
  certificates: "Certificates",
  languages: "Languages",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2023-05" → "May 2023", "2023" → "2023". Anything else comes back as it was. */
export function fmtDate(d?: string): string {
  if (!d) return "";
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(d.trim());
  if (!m) return d.trim();
  const month = m[2] ? MONTHS[Number(m[2]) - 1] : undefined;
  return month ? `${month} ${m[1]}` : m[1];
}

/** "May 2023 – Jun 2024", or "May 2023 – Present" when `ongoing` and there's no end date. */
export function dateRange(start?: string, end?: string, ongoing = false): string {
  const a = fmtDate(start), b = fmtDate(end) || (ongoing && a ? "Present" : "");
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

/** A bullet's text without any bullet character the person typed or pasted in. */
export function cleanBullet(s: string): string {
  return s.replace(/^\s*(?:[•●▪◦‣\-*–—]\s*)+/, "").trim();
}

/** Non-empty bullets, cleaned. */
export function bulletsOf(list?: string[]): string[] {
  return (list ?? []).map(cleanBullet).filter(Boolean);
}

/** The contact line under the name: email, phone, place, website, profiles. Plain text, in that order. */
export function contactParts(b: CvData["basics"]): string[] {
  const place = [b.location?.city, b.location?.country].filter((x) => x && x.trim()).join(", ");
  return [b.email, b.phone, place, b.url, ...(b.profiles ?? []).map((p) => p.url)]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
}

/** Does this section have anything to show? Empty sections are left out of the CV. */
export function hasContent(d: CvData, k: SectionKey): boolean {
  switch (k) {
    case "summary": return !!d.basics.summary?.trim();
    case "skills": return d.skills.some((s) => s.name.trim() || s.keywords.some((w) => w.trim()));
    case "work": return d.work.some((w) => w.position.trim() || w.name.trim());
    case "projects": return d.projects.some((p) => p.name.trim());
    case "education": return d.education.some((e) => e.institution.trim());
    case "certificates": return d.certificates.some((c) => c.name.trim());
    case "languages": return (d.languages ?? []).some((l) => l.language.trim());
  }
}

/** The sections to print, in the person's order, skipping empty ones. */
export function visibleSections(d: CvData): SectionKey[] {
  return d.sectionOrder.filter((k) => hasContent(d, k));
}

/** "Skill group: a, b, c", or just the keywords when the group has no name. */
export function skillLine(s: CvData["skills"][number]): string {
  const words = s.keywords.map((w) => w.trim()).filter(Boolean).join(", ");
  const name = s.name.trim();
  return name && words ? `${name}: ${words}` : name || words;
}

/** "Jane-Doe-CV.pdf". Letters, digits and dashes only, so it's safe in a download header. */
export function cvFileName(name: string, ext = "pdf"): string {
  const base = name.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
  return `${base || "My"}-CV.${ext}`;
}

/* ---------- the whole CV as lines of text ---------- */
/*
 * The "classic" CV as lines, in reading order. The on-screen preview, the PDF and the Word file all draw from this,
 * so the three say exactly the same thing in the same order; they only differ in how they draw it.
 */

/** A piece of text, optionally bold. A line is a list of runs. */
export type Run = { text: string; bold?: boolean };
/** One job, project or school: a heading line, a grey date line, paragraphs, bullet points. */
export type Entry = { head: Run[]; meta?: string; paras: string[]; bullets: string[] };
/** Plain lines (summary, skills, certificates, languages) or entries (experience, projects, education). */
export type LaidSection =
  | { key: SectionKey; title: string; kind: "lines"; lines: Run[][] }
  | { key: SectionKey; title: string; kind: "entries"; entries: Entry[] };
export type CvLayout = { name: string; label: string; contact: string; sections: LaidSection[] };

const tt = (s?: string) => (s ?? "").trim();
const joined = (...parts: (string | undefined)[]) => parts.map(tt).filter(Boolean).join(", ");
/** "Bold — rest", as runs. */
const head = (bold: string, rest?: string): Run[] => [{ text: bold, bold: true }, ...(rest ? [{ text: ` — ${rest}` }] : [])];

function laySection(d: CvData, key: SectionKey): LaidSection | null {
  if (!hasContent(d, key)) return null;
  const title = SECTION_LABELS[key];
  switch (key) {
    case "summary":
      return { key, title, kind: "lines", lines: [[{ text: tt(d.basics.summary) }]] };
    case "skills":
      return { key, title, kind: "lines", lines: d.skills.map(skillLine).filter(Boolean).map((text) => [{ text }]) };
    case "work":
      return { key, title, kind: "entries", entries: d.work.filter((w) => tt(w.position) || tt(w.name)).map((w) => ({
        head: head(tt(w.position) || tt(w.name), joined(tt(w.position) ? w.name : "", w.location)),
        meta: dateRange(w.startDate, w.endDate, true) || undefined, paras: [], bullets: bulletsOf(w.highlights),
      })) };
    case "projects":
      return { key, title, kind: "entries", entries: d.projects.filter((p) => tt(p.name)).map((p) => ({
        head: head(tt(p.name), tt(p.url)), paras: tt(p.description) ? [tt(p.description)] : [], bullets: bulletsOf(p.highlights),
      })) };
    case "education":
      return { key, title, kind: "entries", entries: d.education.filter((e) => tt(e.institution)).map((e) => {
        const what = joined(e.studyType, e.area);
        const meta = [dateRange(e.startDate, e.endDate), tt(e.score) && `Result: ${tt(e.score)}`].filter(Boolean).join(" | ");
        return { head: head(what || tt(e.institution), what ? tt(e.institution) : undefined), meta: meta || undefined, paras: [], bullets: [] };
      }) };
    case "certificates":
      return { key, title, kind: "lines", lines: d.certificates.filter((c) => tt(c.name)).map((c) => {
        const by = joined(c.issuer, fmtDate(c.date));
        return [{ text: tt(c.name), bold: true }, ...(by ? [{ text: ` — ${by}` }] : []), ...(tt(c.url) ? [{ text: ` | ${tt(c.url)}` }] : [])];
      }) };
    case "languages":
      return { key, title, kind: "lines", lines: [[{ text: (d.languages ?? []).filter((l) => tt(l.language))
        .map((l) => (tt(l.fluency) ? `${tt(l.language)} (${tt(l.fluency)})` : tt(l.language))).join(", ") }]] };
  }
}

export function layoutCv(d: CvData): CvLayout {
  return {
    name: tt(d.basics.name), label: tt(d.basics.label), contact: contactParts(d.basics).join(" | "),
    sections: d.sectionOrder.map((k) => laySection(d, k)).filter((s): s is LaidSection => !!s),
  };
}

/** The whole CV as plain text in reading order: what an ATS should read out of the PDF or Word file. */
export function layoutText(l: CvLayout): string {
  const line = (r: Run[]) => r.map((x) => x.text).join("");
  return [l.name, l.label, l.contact, ...l.sections.flatMap((s) => [
    s.title.toUpperCase(),
    ...(s.kind === "lines" ? s.lines.map(line) : s.entries.flatMap((e) => [line(e.head), ...(e.meta ? [e.meta] : []), ...e.paras, ...e.bullets.map((b) => `• ${b}`)])),
  ])].filter(Boolean).join("\n");
}
