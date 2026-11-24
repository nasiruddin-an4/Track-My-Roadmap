/*
 * ATS match score: how well a CV fits a job description, out of 100.
 *   Keywords  60  the job's skills and terms found in the CV (required ones count double)
 *   Structure 25  contact email, a Skills section, Experience or Projects, dates, short bullets, no half-filled entries
 *   Wording   15  bullets that start with an action verb, and some with numbers
 * The AI only reads the keywords out of the job description; all matching and scoring happens here, in code,
 * so the same CV and keywords always give the same score (in the browser as you edit, and on the server).
 *
 * Type-only imports: the unit tests run this file directly.
 */
import type { CvData, SectionKey } from "./schema";

export type JobKeyword = { term: string; importance: "required" | "preferred"; synonyms: string[] };
export type AtsSection = SectionKey | "basics";
export type AtsSuggestion = { section: AtsSection; message: string; level: "high" | "medium" | "low" };
export type AtsCheck = { id: string; label: string; pass: boolean };
export type AtsResult = {
  score: number;
  parts: { keywords: number; structure: number; wording: number }; // each 0..1
  matched: JobKeyword[];
  missing: JobKeyword[];
  checks: AtsCheck[];
  suggestions: AtsSuggestion[];
};

/* ---------- keyword matching ---------- */

/** Lowercase words, keeping the characters that matter in tech names (c++, c#, .net). */
export function normalize(s: string): string {
  return ` ${s.toLowerCase().replace(/\.(?=net\b)/g, "dot").replace(/[^a-z0-9+#]+/g, " ").trim()} `;
}

// common ways the same thing is written; each list is one skill
const SAME: string[][] = [
  ["javascript", "js", "ecmascript", "es6"], ["typescript", "ts"], ["node js", "nodejs", "node"], ["react", "react js", "reactjs"],
  ["next js", "nextjs"], ["vue", "vue js", "vuejs"], ["postgresql", "postgres", "psql"], ["kubernetes", "k8s"],
  ["amazon web services", "aws"], ["google cloud", "gcp", "google cloud platform"], ["microsoft azure", "azure"],
  ["continuous integration", "ci cd", "ci", "cicd"], ["machine learning", "ml"], ["artificial intelligence", "ai"],
  ["rest api", "rest apis", "restful", "rest"], ["user interface", "ui"], ["user experience", "ux"],
  ["mongodb", "mongo"], ["golang", "go"], ["c#", "csharp"], ["c++", "cpp"], ["dotnet", "net"], ["html5", "html"], ["css3", "css"],
];
const SYN = new Map<string, string[]>();
for (const group of SAME) for (const w of group) SYN.set(w, group);

function variants(term: string, extra: string[]): string[] {
  const out = new Set<string>();
  for (const raw of [term, ...extra]) {
    const t = normalize(raw).trim();
    if (!t) continue;
    out.add(t);
    for (const s of SYN.get(t) ?? []) out.add(s);
    if (t.length > 3 && t.endsWith("s")) out.add(t.slice(0, -1)); // apis → api
    else if (t.length > 2 && /[a-z]$/.test(t)) out.add(t + "s");    // api → apis
  }
  return [...out];
}

/** Is the keyword (or one of its other spellings) in the CV text? Whole words only, so "go" isn't found in "google". */
export function hasKeyword(cvNorm: string, kw: Pick<JobKeyword, "term" | "synonyms">): boolean {
  const compact = cvNorm.replace(/ /g, "");
  return variants(kw.term, kw.synonyms).some((v) => cvNorm.includes(` ${v} `) || (v.replace(/ /g, "").length >= 5 && compact.includes(v.replace(/ /g, ""))));
}

/** All the words on the CV, as one string. */
export function cvText(d: CvData): string {
  const b = d.basics;
  return [
    b.label, b.summary,
    ...d.skills.flatMap((s) => [s.name, ...s.keywords]),
    ...d.work.flatMap((w) => [w.position, w.name, ...w.highlights]),
    ...d.projects.flatMap((p) => [p.name, p.description, ...(p.highlights ?? [])]),
    ...d.education.flatMap((e) => [e.studyType, e.area, e.institution]),
    ...d.certificates.flatMap((c) => [c.name, c.issuer]),
    ...(d.languages ?? []).map((l) => l.language),
  ].filter(Boolean).join(" \n ");
}

/* ---------- wording ---------- */

const VERBS = new Set(("achieved added analysed analyzed architected assisted automated boosted built championed coached collaborated completed configured " +
  "contributed converted coordinated created cut debugged decreased defined delivered deployed designed developed directed drove eliminated enabled " +
  "engineered enhanced established evaluated expanded facilitated fixed founded generated grew guided handled identified implemented improved " +
  "increased initiated integrated introduced launched led maintained managed mentored migrated modernized modernised monitored negotiated optimized " +
  "optimised organized organised oversaw owned partnered performed pioneered planned presented produced programmed proposed prototyped published " +
  "raised rebuilt redesigned reduced refactored released replaced researched resolved restructured revamped saved scaled secured served set shipped " +
  "simplified solved spearheaded standardized streamlined strengthened supervised supported tested trained transformed tripled doubled troubleshot " +
  "unified upgraded used won wrote " +
  "build design develop lead manage create implement maintain test deploy write improve own drive").split(/\s+/));
const NOT_VERBS = new Set(["experienced", "skilled", "detailed", "dedicated", "motivated", "talented", "certified", "interested", "based", "seasoned"]);

export function startsWithVerb(bullet: string): boolean {
  const w = bullet.trim().toLowerCase().match(/^[a-z]+/)?.[0] ?? "";
  if (!w || NOT_VERBS.has(w)) return false;
  return VERBS.has(w) || (w.length > 4 && w.endsWith("ed"));
}

/** Two printed lines at 10.5pt on A4 hold roughly 190 characters. */
export const BULLET_MAX = 190;

/* ---------- the score ---------- */

const hasDate = (s?: string) => !!s && /^\d{4}/.test(s);

export function scoreCv(d: CvData, keywords: JobKeyword[]): AtsResult {
  const suggestions: AtsSuggestion[] = [];
  const say = (section: AtsSection, message: string, level: AtsSuggestion["level"] = "medium") => suggestions.push({ section, message, level });

  // keywords: required count double
  const norm = normalize(cvText(d));
  const matched: JobKeyword[] = [], missing: JobKeyword[] = [];
  let got = 0, total = 0;
  for (const k of keywords) {
    const w = k.importance === "required" ? 2 : 1;
    total += w;
    if (hasKeyword(norm, k)) { matched.push(k); got += w; } else missing.push(k);
  }
  const kwPart = total ? got / total : 0;
  const missReq = missing.filter((k) => k.importance === "required");
  if (missReq.length) say("skills", `The job asks for ${list(missReq.map((k) => k.term))}. If you have ${missReq.length > 1 ? "these" : "this"}, add ${missReq.length > 1 ? "them" : "it"} to Skills and mention where you used ${missReq.length > 1 ? "them" : "it"}.`, "high");
  const missPref = missing.filter((k) => k.importance === "preferred");
  if (missPref.length) say("skills", `Nice to have for this job: ${list(missPref.map((k) => k.term))}. Add any you know.`, "low");

  // structure
  const bullets = [
    ...d.work.flatMap((w) => w.highlights.filter((h) => h.trim()).map((text) => ({ text, section: "work" as const }))),
    ...d.projects.flatMap((p) => (p.highlights ?? []).filter((h) => h.trim()).map((text) => ({ text, section: "projects" as const }))),
  ];
  const work = d.work.filter((w) => w.position.trim() || w.name.trim());
  const badDates = work.filter((w) => !hasDate(w.startDate) || (hasDate(w.endDate) && (w.endDate ?? "") < w.startDate));
  const long = bullets.filter((b) => b.text.trim().length > BULLET_MAX);
  const halfFilled = [
    ...work.filter((w) => !w.position.trim() || !w.name.trim()).map(() => "work" as const),
    ...d.education.filter((e) => e.institution.trim() && !e.studyType?.trim() && !e.area?.trim()).map(() => "education" as const),
    ...d.skills.filter((s) => s.name.trim() && !s.keywords.some((k) => k.trim())).map(() => "skills" as const),
  ];
  const hasSkills = d.skills.some((s) => s.keywords.some((k) => k.trim()));
  const hasWork = work.length > 0 || d.projects.some((p) => p.name.trim());
  const checks: AtsCheck[] = [
    { id: "email", label: "Email address at the top", pass: !!d.basics.email.trim() },
    { id: "skills", label: "A Skills section", pass: hasSkills },
    { id: "experience", label: "Experience or Projects", pass: hasWork },
    { id: "dates", label: "Every job has a start date, in order", pass: work.length > 0 && badDates.length === 0 },
    { id: "bullets", label: "Bullets under two lines", pass: long.length === 0 },
    { id: "complete", label: "No half-filled entries", pass: halfFilled.length === 0 },
  ];
  if (!checks[0].pass) say("basics", "Add your email address: recruiters and ATS systems look for it at the top.", "high");
  if (!hasSkills) say("skills", "Add a Skills section. Most ATS systems search it first.", "high");
  if (!hasWork) say("work", "Add your experience or at least one project, with what you did.", "high");
  if (badDates.length) say("work", `Give every job a start date (and an end date after it): ${list(badDates.map((w) => w.position || w.name))}.`, "medium");
  for (const b of long.slice(0, 3)) say(b.section, `Shorten this point to under two lines: “${clip(b.text)}”`, "medium");
  if (halfFilled.length) say(halfFilled[0], "Finish or remove entries that are only half filled in.", "low");
  const structPart = checks.filter((c) => c.pass).length / checks.length;

  // wording
  let wordPart = 0;
  if (bullets.length) {
    const verbs = bullets.filter((b) => startsWithVerb(b.text));
    const numbers = bullets.filter((b) => /\d/.test(b.text));
    wordPart = (verbs.length / bullets.length) * 0.6 + Math.min(1, numbers.length / bullets.length / 0.4) * 0.4;
    const weak = bullets.filter((b) => !startsWithVerb(b.text));
    if (weak.length) say(weak[0].section, `Start points with an action verb (Built, Led, Improved…), e.g. “${clip(weak[0].text)}”.`, "medium");
    if (numbers.length / bullets.length < 0.4) say(bullets[0].section, "Add numbers where you can: users, time saved, percentages, team size.", "low");
  } else {
    say("work", "Add bullet points under your jobs or projects describing what you did.", "medium");
  }
  if (!d.basics.summary?.trim()) say("summary", "Add a 2–3 line summary that uses the job’s main keywords.", "low");

  const score = Math.round(60 * kwPart + 25 * structPart + 15 * wordPart);
  const order = { high: 0, medium: 1, low: 2 };
  return {
    score,
    parts: { keywords: kwPart, structure: structPart, wording: wordPart },
    matched, missing, checks,
    suggestions: suggestions.sort((a, b) => order[a.level] - order[b.level]),
  };
}

const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).slice(0, 7).join(", ")}${a.length > 8 ? " and others" : ` and ${a[a.length - 1]}`}`);
const clip = (s: string) => (s.trim().length > 70 ? s.trim().slice(0, 67) + "…" : s.trim());

/* ---------- AI rewrites must not invent numbers ---------- */

// 40, 1,200, 3.5, 40%, 40 %, 10k, 2M, 3x
const NUM = /\d+(?:[.,]\d+)*(?:\s?(?:%|k\b|m\b|x\b))?/gi;
const numKey = (n: string) => n.replace(/\s/g, "").toLowerCase();

/**
 * Numbers in a rewrite that aren't in the source become "[X]" placeholders for the person to fill in,
 * so the AI can suggest where a number would help but can't make one up.
 */
export function guardNumbers(source: string, rewrite: string): string {
  const known = new Set((source.match(NUM) ?? []).map(numKey));
  return rewrite.replace(NUM, (n) => (known.has(numKey(n)) ? n : `[X${/%/.test(n) ? "%" : ""}]`));
}
