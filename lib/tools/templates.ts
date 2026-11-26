/*
 * Ready-made student documents: a leave application, a testimonial or transfer-certificate application, a job
 * cover letter and an assignment cover page. Each one is a form plus a function that lays the document out as
 * simple blocks; the page draws the blocks on screen, prints them (Save as PDF) and builds the Word file from them,
 * so all three match. Letters follow the formats taught in Bangladeshi schools, in English and in Bengali.
 *
 * No runtime imports: the unit tests run this file directly.
 */

export type Lang = "en" | "bn";
export type Values = Record<string, string>;

export type Run = { text: string; bold?: boolean };
export type Block =
  /** a paragraph; `gap` is extra space above it in points; size in points (default 12) */
  | { t: "p"; runs: Run[]; align?: "left" | "center" | "right"; size?: number; gap?: number }
  | { t: "bullets"; items: string[]; gap?: number }
  /** side-by-side columns, e.g. "Submitted to" / "Submitted by" on a cover page */
  | { t: "cols"; cols: { title: string; lines: Run[][] }[]; gap?: number }
  | { t: "image"; src: string; width: number; gap?: number };

export type FieldDef = {
  key: string;
  label: Record<Lang, string>;
  kind: "text" | "textarea" | "date" | "select" | "image";
  options?: { value: string; label: Record<Lang, string> }[];
  placeholder?: Partial<Record<Lang, string>>;
  /** starting value; "today" means today's date */
  initial?: string;
  /** remembered on this device and filled into every template (name, school, roll…) */
  shared?: boolean;
  /** only for these languages */
  langs?: Lang[];
  show?: (v: Values) => boolean;
  half?: boolean;
};

export type TemplateDef = {
  slug: string;
  langs: Lang[];
  fields: FieldDef[];
  render: (v: Values, lang: Lang) => Block[];
  fileName: (v: Values, lang: Lang) => string;
};

/* ---------- helpers ---------- */

export const bnDigits = (s: string) => s.replace(/\d/g, (d) => String.fromCharCode(0x09e6 + Number(d)));
const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};

/** "2026-11-26" → "26 November 2026" or "২৬ নভেম্বর ২০২৬". Empty or broken dates come back empty. */
export function longDate(iso: string | undefined, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  const s = `${Number(m[3])} ${MONTHS[lang][Number(m[2]) - 1]} ${m[1]}`;
  return lang === "bn" ? bnDigits(s) : s;
}

/** Days from one date to another, counting both (26–28 November is 3 days). null if either is missing or reversed. */
export function daysBetween(from?: string, to?: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** The value, or a [hint] in its place so the preview shows what's still to fill in. */
const or = (v: string | undefined, hint: string) => (v && v.trim() ? v.trim() : `[${hint}]`);
const num = (n: string | number, lang: Lang) => (lang === "bn" ? bnDigits(String(n)) : String(n));
const p = (text: string, o: { gap?: number; bold?: boolean; align?: "left" | "center" | "right"; size?: number } = {}): Block =>
  ({ t: "p", runs: [{ text, bold: o.bold }], gap: o.gap, align: o.align, size: o.size });
const lines = (list: (string | false | undefined)[], gap?: number): Block[] =>
  list.filter((x): x is string => !!x).map((text, i) => p(text, { gap: i ? 0 : gap }));
/** "Subject: …" with the word in bold */
const subject = (label: string, text: string): Block => ({ t: "p", runs: [{ text: `${label} `, bold: true }, { text }], gap: 14 });

/* ---------- shared fields ---------- */

const KINDS = [
  { value: "school", label: { en: "School", bn: "বিদ্যালয়" } },
  { value: "college", label: { en: "College", bn: "কলেজ" } },
  { value: "madrasa", label: { en: "Madrasa", bn: "মাদ্রাসা" } },
];
const KIND = {
  en: { school: "school", college: "college", madrasa: "madrasa" },
  /** of the school, at the school */
  bnOf: { school: "বিদ্যালয়ের", college: "কলেজের", madrasa: "মাদ্রাসার" },
  bnAt: { school: "বিদ্যালয়ে", college: "কলেজে", madrasa: "মাদ্রাসায়" },
  bn: { school: "বিদ্যালয়", college: "কলেজ", madrasa: "মাদ্রাসা" },
} as const;
type Kind = keyof typeof KIND.en;
const kindOf = (v: Values): Kind => (v.kind in KIND.en ? (v.kind as Kind) : "school");
const HEAD: Record<Lang, Record<Kind, string>> = {
  en: { school: "The Headmaster", college: "The Principal", madrasa: "The Principal" },
  bn: { school: "প্রধান শিক্ষক", college: "অধ্যক্ষ", madrasa: "অধ্যক্ষ" },
};
const pupil = (v: Values) => (v.gender === "girl" ? "ছাত্রী" : "ছাত্র");

const f = {
  kind: { key: "kind", kind: "select", options: KINDS, initial: "school", half: true, label: { en: "School or college", bn: "প্রতিষ্ঠান" } },
  recipient: { key: "recipient", kind: "text", half: true, label: { en: "To", bn: "বরাবর" }, placeholder: { en: "The Headmaster", bn: "প্রধান শিক্ষক" } },
  institution: { key: "institution", kind: "text", shared: true, label: { en: "Name of your school or college", bn: "প্রতিষ্ঠানের নাম" }, placeholder: { en: "e.g. Motijheel Govt. Boys’ High School", bn: "যেমন: মতিঝিল সরকারি বালক উচ্চ বিদ্যালয়" } },
  place: { key: "place", kind: "text", shared: true, label: { en: "Area and district", bn: "ঠিকানা" }, placeholder: { en: "e.g. Motijheel, Dhaka", bn: "যেমন: মতিঝিল, ঢাকা" } },
  name: { key: "name", kind: "text", shared: true, label: { en: "Your name", bn: "তোমার নাম" } },
  cls: { key: "class", kind: "text", shared: true, half: true, label: { en: "Class", bn: "শ্রেণি" }, placeholder: { en: "e.g. Nine", bn: "যেমন: নবম" } },
  section: { key: "section", kind: "text", shared: true, half: true, label: { en: "Section", bn: "শাখা" }, placeholder: { en: "optional", bn: "না থাকলে খালি রাখো" } },
  roll: { key: "roll", kind: "text", shared: true, half: true, label: { en: "Roll", bn: "রোল" } },
  gender: {
    key: "gender", kind: "select", langs: ["bn"], half: true, initial: "boy", label: { en: "You are", bn: "তুমি" },
    options: [{ value: "boy", label: { en: "Student (boy)", bn: "ছাত্র" } }, { value: "girl", label: { en: "Student (girl)", bn: "ছাত্রী" } }],
  },
  date: { key: "date", kind: "date", initial: "today", half: true, label: { en: "Date of the letter", bn: "চিঠির তারিখ" } },
} satisfies Record<string, FieldDef>;

/** Date, then "To" and the address block. */
function header(v: Values, lang: Lang): Block[] {
  const head = v.recipient?.trim() || HEAD[lang][kindOf(v)];
  return [
    p(`${lang === "bn" ? "তারিখ" : "Date"}: ${or(longDate(v.date, lang), lang === "bn" ? "তারিখ" : "date")}`),
    ...lines([lang === "bn" ? "বরাবর" : "To", head, or(v.institution, lang === "bn" ? "প্রতিষ্ঠানের নাম" : "school name"), v.place?.trim()], 14),
  ];
}

/** "Yours obediently," and the student's details. */
function signOff(v: Values, lang: Lang, opts: { classLine?: boolean } = {}): Block[] {
  const section = v.section?.trim();
  if (lang === "bn") {
    return lines([
      "বিনীত নিবেদক",
      `আপনার একান্ত অনুগত ${pupil(v)}`,
      or(v.name, "তোমার নাম"),
      opts.classLine !== false && `শ্রেণি: ${or(v.class, "শ্রেণি")}${section ? `, শাখা: ${section}` : ""}`,
      `রোল: ${or(v.roll, "রোল")}`,
    ], 18);
  }
  return lines([
    "Yours obediently,",
    or(v.name, "your name"),
    opts.classLine !== false && `Class: ${or(v.class, "class")}${section ? `, Section: ${section}` : ""}`,
    `Roll: ${or(v.roll, "roll")}`,
  ], 18);
}

/* ---------- leave application ---------- */

const REASONS: Record<string, { en: [string, string]; bn: string }> = {
  sick: { en: ["I was ill with a fever", "I am ill with a fever and the doctor has advised me to rest"], bn: "অসুস্থতার" },
  family: { en: ["I had to go to my village home for an urgent family matter", "I have to go to my village home for an urgent family matter"], bn: "জরুরি পারিবারিক কাজে গ্রামের বাড়ি যাওয়ার" },
  wedding: { en: ["I had to attend my elder sister’s wedding", "I have to attend my elder sister’s wedding"], bn: "বড় বোনের বিয়েতে অংশ নেওয়ার" },
};

const leave: TemplateDef = {
  slug: "leave-application",
  langs: ["en", "bn"],
  fields: [
    f.kind, f.recipient, f.institution, f.place,
    {
      key: "when", kind: "select", initial: "past", label: { en: "The leave is for", bn: "ছুটি কখনকার" },
      options: [{ value: "past", label: { en: "Days I already missed", bn: "যে দিনগুলো অনুপস্থিত ছিলাম" } }, { value: "future", label: { en: "Days coming up", bn: "সামনের দিনগুলো" } }],
    },
    { key: "from", kind: "date", half: true, label: { en: "From", bn: "শুরু" } },
    { key: "to", kind: "date", half: true, label: { en: "To", bn: "শেষ" } },
    {
      key: "reason", kind: "select", initial: "sick", label: { en: "Reason", bn: "কারণ" },
      options: [
        { value: "sick", label: { en: "Illness (fever)", bn: "অসুস্থতা" } },
        { value: "family", label: { en: "Urgent family matter", bn: "জরুরি পারিবারিক কাজ" } },
        { value: "wedding", label: { en: "Sister’s wedding", bn: "বোনের বিয়ে" } },
        { value: "other", label: { en: "Write my own", bn: "নিজে লিখব" } },
      ],
    },
    {
      key: "reasonText", kind: "text", show: (v) => v.reason === "other", label: { en: "Because…", bn: "কারণ" },
      placeholder: { en: "e.g. my grandmother was seriously ill", bn: "যেমন: দাদির গুরুতর অসুস্থতার" },
    },
    f.name, f.gender, f.cls, f.section, f.roll, f.date,
  ],
  fileName: (v, lang) => (lang === "bn" ? "chhutir-abedon" : "leave-application"),
  render(v, lang) {
    const kind = kindOf(v);
    const past = v.when !== "future";
    const n = daysBetween(v.from, v.to);
    const nTxt = n ? num(n, lang) : lang === "bn" ? "[দিনের সংখ্যা]" : "[number of]";
    const from = or(longDate(v.from, lang), lang === "bn" ? "শুরুর তারিখ" : "first day");
    const to = or(longDate(v.to, lang), lang === "bn" ? "শেষ তারিখ" : "last day");
    const section = v.section?.trim();
    if (lang === "bn") {
      const why = v.reason === "other" ? or(v.reasonText, "কারণ") : (REASONS[v.reason] ?? REASONS.sick).bn;
      return [
        ...header(v, lang),
        subject("বিষয়:", `${nTxt} দিনের ছুটির জন্য আবেদন।`),
        p("জনাব,", { gap: 14 }),
        p(`সবিনয় নিবেদন এই যে, আমি আপনার ${KIND.bnOf[kind]} ${or(v.class, "শ্রেণি")} শ্রেণির${section ? ` ${section} শাখার` : ""} একজন নিয়মিত ${pupil(v)}। `
          + `${why} কারণে আমি ${past ? "গত" : "আগামী"} ${from} থেকে ${to} পর্যন্ত মোট ${nTxt} দিন ${KIND.bnAt[kind]} উপস্থিত থাকতে ${past ? "পারিনি" : "পারব না"}।`, { gap: 8 }),
        p(`অতএব, মহোদয়ের নিকট বিনীত প্রার্থনা এই যে, আমাকে উক্ত ${nTxt} দিনের ছুটি মঞ্জুর করে বাধিত করবেন।`, { gap: 8 }),
        ...signOff(v, lang),
      ];
    }
    const why = v.reason === "other" ? or(v.reasonText, "reason") : (REASONS[v.reason] ?? REASONS.sick).en[past ? 0 : 1];
    const days = n === 1 ? "1 day" : `${nTxt} days`;
    return [
      ...header(v, lang),
      subject("Subject:", `Application for leave of absence for ${days}.`),
      p("Respected Sir/Madam,", { gap: 14 }),
      p(`With due respect, I would like to inform you that I am a regular student of Class ${or(v.class, "class")}${section ? `, Section ${section}` : ""} of your ${KIND.en[kind]}. `
        + `${past ? "I could not attend" : "I will not be able to attend"} ${KIND.en[kind]} from ${from} to ${to} (${days}) because ${why}.`, { gap: 8 }),
      p(`I, therefore, pray and hope that you would be kind enough to grant me leave for ${past ? "those" : "the"} ${days}.`, { gap: 8 }),
      ...signOff(v, lang),
    ];
  },
};

/* ---------- testimonial or transfer certificate ---------- */

const certificate: TemplateDef = {
  slug: "testimonial-application",
  langs: ["en", "bn"],
  fields: [
    {
      key: "doc", kind: "select", initial: "testimonial", label: { en: "I need a", bn: "যা দরকার" },
      options: [{ value: "testimonial", label: { en: "Testimonial", bn: "প্রশংসাপত্র" } }, { value: "tc", label: { en: "Transfer certificate (TC)", bn: "ছাড়পত্র (টিসি)" } }],
    },
    f.kind, f.recipient, f.institution, f.place,
    { key: "exam", kind: "text", half: true, initial: "SSC", show: (v) => v.doc !== "tc", label: { en: "Exam you passed", bn: "যে পরীক্ষায় পাস করেছ" } },
    { key: "year", kind: "text", half: true, show: (v) => v.doc !== "tc", label: { en: "Year", bn: "সাল" }, placeholder: { en: "e.g. 2026", bn: "যেমন: ২০২৬" } },
    { key: "result", kind: "text", half: true, show: (v) => v.doc !== "tc", label: { en: "Result", bn: "ফলাফল" }, placeholder: { en: "e.g. GPA 5.00", bn: "যেমন: জিপিএ ৫.০০" } },
    { key: "reg", kind: "text", half: true, show: (v) => v.doc !== "tc", label: { en: "Registration number", bn: "রেজিস্ট্রেশন নম্বর" } },
    { key: "purpose", kind: "text", show: (v) => v.doc !== "tc", label: { en: "It’s for (optional)", bn: "কীসের জন্য (ঐচ্ছিক)" }, placeholder: { en: "e.g. college admission", bn: "যেমন: কলেজে ভর্তির" } },
    { key: "why", kind: "text", show: (v) => v.doc === "tc", label: { en: "Why you’re leaving", bn: "কেন ছেড়ে যাচ্ছ" }, placeholder: { en: "e.g. my father has been transferred to Chattogram", bn: "যেমন: বাবার চট্টগ্রামে বদলি হওয়ার" } },
    f.name, f.gender,
    { ...f.cls, show: (v: Values) => v.doc === "tc" },
    { ...f.section, show: (v: Values) => v.doc === "tc" },
    f.roll, f.date,
  ],
  fileName: (v) => (v.doc === "tc" ? "transfer-certificate-application" : "testimonial-application"),
  render(v, lang) {
    const kind = kindOf(v);
    const tc = v.doc === "tc";
    const section = v.section?.trim();
    if (lang === "bn") {
      const body = tc
        ? `সবিনয় নিবেদন এই যে, আমি আপনার ${KIND.bnOf[kind]} ${or(v.class, "শ্রেণি")} শ্রেণির${section ? ` ${section} শাখার` : ""} একজন নিয়মিত ${pupil(v)}, রোল নম্বর ${or(v.roll, "রোল")}। `
          + `${or(v.why, "কারণ")} কারণে আমাকে এই ${KIND.bn[kind]} ছেড়ে যেতে হচ্ছে।`
        : `সবিনয় নিবেদন এই যে, আমি আপনার ${KIND.bnOf[kind]} একজন প্রাক্তন ${pupil(v)}। আমি ${or(v.year, "সাল")} সালে এই ${KIND.bn[kind]} থেকে `
          + `${or(v.exam, "পরীক্ষা")} পরীক্ষায় অংশ নিয়ে ${or(v.result, "ফলাফল")} পেয়ে উত্তীর্ণ হয়েছি। আমার রোল নম্বর ${or(v.roll, "রোল")} এবং রেজিস্ট্রেশন নম্বর ${or(v.reg, "রেজিস্ট্রেশন নম্বর")}। `
          + `${v.purpose?.trim() ? `${v.purpose.trim()} জন্য ` : ""}আমার একটি প্রশংসাপত্র প্রয়োজন।`;
      return [
        ...header(v, lang),
        subject("বিষয়:", tc ? "ছাড়পত্রের (টিসি) জন্য আবেদন।" : "প্রশংসাপত্রের জন্য আবেদন।"),
        p("জনাব,", { gap: 14 }),
        p(body, { gap: 8 }),
        p(`অতএব, মহোদয়ের নিকট বিনীত প্রার্থনা এই যে, আমাকে একটি ${tc ? "ছাড়পত্র" : "প্রশংসাপত্র"} প্রদান করে বাধিত করবেন।`, { gap: 8 }),
        ...signOff(v, lang, { classLine: tc }),
      ];
    }
    const body = tc
      ? `With due respect, I would like to inform you that I am a regular student of Class ${or(v.class, "class")}${section ? `, Section ${section}` : ""} of your ${KIND.en[kind]}, `
        + `and my roll number is ${or(v.roll, "roll")}. I have to leave this ${KIND.en[kind]} because ${or(v.why, "reason")}.`
      : `With due respect, I would like to inform you that I passed the ${or(v.exam, "exam")} examination in ${or(v.year, "year")} from your ${KIND.en[kind]} with ${or(v.result, "result")}. `
        + `My roll number was ${or(v.roll, "roll")} and my registration number is ${or(v.reg, "registration number")}. I now need a testimonial${v.purpose?.trim() ? ` for ${v.purpose.trim()}` : ""}.`;
    return [
      ...header(v, lang),
      subject("Subject:", tc ? "Application for a transfer certificate." : "Application for a testimonial."),
      p("Respected Sir/Madam,", { gap: 14 }),
      p(body, { gap: 8 }),
      p(tc
        ? `I, therefore, pray that you would kindly issue me a transfer certificate so that I can get admitted to a new ${KIND.en[kind]}.`
        : "I, therefore, pray that you would kindly issue me a testimonial.", { gap: 8 }),
      ...signOff(v, lang, { classLine: tc }),
    ];
  },
};

/* ---------- cover letter ---------- */

const coverLetter: TemplateDef = {
  slug: "cover-letter",
  langs: ["en"],
  fields: [
    { ...f.name },
    { key: "phone", kind: "text", shared: true, half: true, label: { en: "Phone", bn: "ফোন" }, placeholder: { en: "+880 1XXX-XXXXXX" } },
    { key: "email", kind: "text", shared: true, half: true, label: { en: "Email", bn: "ইমেইল" } },
    { key: "job", kind: "text", half: true, label: { en: "Job title", bn: "পদের নাম" }, placeholder: { en: "e.g. Junior Software Engineer" } },
    { key: "company", kind: "text", half: true, label: { en: "Company", bn: "প্রতিষ্ঠান" } },
    { key: "manager", kind: "text", half: true, label: { en: "Hiring manager (if you know)", bn: "নিয়োগকর্তা" }, placeholder: { en: "e.g. Ms. Farhana Rahman" } },
    { key: "source", kind: "text", half: true, label: { en: "Where you saw the job", bn: "কোথায় দেখেছ" }, placeholder: { en: "e.g. BDJobs" } },
    { key: "companyAddress", kind: "textarea", label: { en: "Company address (optional)", bn: "ঠিকানা" } },
    { key: "status", kind: "text", label: { en: "Who you are, in one line", bn: "পরিচয়" }, placeholder: { en: "e.g. a final-year CSE student at Daffodil International University" } },
    { key: "strengths", kind: "textarea", label: { en: "What you can offer (one per line)", bn: "দক্ষতা" }, placeholder: { en: "Built a web app with React and Node.js used by 300 students\nComfortable with Git, SQL and REST APIs\nFluent in English and Bengali" } },
    { key: "whyCompany", kind: "textarea", label: { en: "Why this company (optional)", bn: "কেন এই প্রতিষ্ঠান" }, placeholder: { en: "e.g. I admire how bKash has made payments simple for millions of people…" } },
    { ...f.date },
  ],
  fileName: () => "cover-letter",
  render(v) {
    const company = or(v.company, "Company");
    const strengths = (v.strengths ?? "").split("\n").map((s) => s.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
    const contact = [v.phone?.trim(), v.email?.trim()].filter(Boolean).join(" | ");
    return [
      { t: "p", runs: [{ text: or(v.name, "Your name"), bold: true }], size: 14 },
      ...(contact ? [p(contact)] : []),
      p(or(longDate(v.date, "en"), "date"), { gap: 18 }),
      ...lines([v.manager?.trim(), company, ...(v.companyAddress ?? "").split("\n").map((s) => s.trim())], 14),
      p(`Dear ${v.manager?.trim() || "Hiring Manager"},`, { gap: 18 }),
      p(`I am writing to apply for the ${or(v.job, "job title")} position at ${company}${v.source?.trim() ? `, which I saw on ${v.source.trim()}` : ""}. `
        + `I am ${or(v.status, "who you are, in one line")}, and I would welcome the chance to bring my skills to your team.`, { gap: 10 }),
      ...(strengths.length ? [p("Here is what I can offer:", { gap: 10 }), { t: "bullets" as const, items: strengths, gap: 4 }] : []),
      ...(v.whyCompany?.trim() ? [p(v.whyCompany.trim(), { gap: 10 })] : []),
      p(`I have attached my CV for your review. Thank you for considering my application. I would be glad to discuss how I can contribute to ${company}.`, { gap: 10 }),
      ...lines(["Sincerely,", or(v.name, "Your name")], 18),
    ];
  },
};

/* ---------- assignment cover page ---------- */

const coverPage: TemplateDef = {
  slug: "assignment-cover-page",
  langs: ["en", "bn"],
  fields: [
    { key: "logo", kind: "image", label: { en: "Logo (optional)", bn: "লোগো (ঐচ্ছিক)" } },
    { ...f.institution, label: { en: "University, college or school", bn: "প্রতিষ্ঠানের নাম" }, placeholder: { en: "e.g. University of Dhaka", bn: "যেমন: ঢাকা বিশ্ববিদ্যালয়" } },
    { key: "department", kind: "text", shared: true, label: { en: "Department (optional)", bn: "বিভাগ (ঐচ্ছিক)" }, placeholder: { en: "e.g. Department of Computer Science and Engineering", bn: "যেমন: বাংলা বিভাগ" } },
    { key: "courseCode", kind: "text", half: true, label: { en: "Course code (optional)", bn: "কোর্স কোড (ঐচ্ছিক)" }, placeholder: { en: "e.g. CSE-2201" } },
    { key: "courseTitle", kind: "text", half: true, label: { en: "Course or subject", bn: "বিষয়" }, placeholder: { en: "e.g. Data Structures", bn: "যেমন: বাংলাদেশ ও বিশ্বপরিচয়" } },
    { key: "title", kind: "textarea", label: { en: "Assignment title", bn: "অ্যাসাইনমেন্টের শিরোনাম" }, placeholder: { en: "e.g. Implementation of a Binary Search Tree", bn: "যেমন: মুক্তিযুদ্ধে বাংলাদেশের নারীদের অবদান" } },
    { key: "teacher", kind: "text", half: true, label: { en: "Teacher’s name", bn: "শিক্ষকের নাম" } },
    { key: "teacherTitle", kind: "text", half: true, label: { en: "Teacher’s designation", bn: "শিক্ষকের পদবি" }, placeholder: { en: "e.g. Lecturer", bn: "যেমন: সহকারী শিক্ষক" } },
    f.name,
    { key: "studentId", kind: "text", shared: true, half: true, label: { en: "Student ID or roll", bn: "রোল / আইডি" } },
    { key: "batch", kind: "text", shared: true, half: true, label: { en: "Section, batch or class", bn: "শ্রেণি / শাখা" }, placeholder: { en: "e.g. Batch 27, Section B", bn: "যেমন: দশম, খ শাখা" } },
    { ...f.date, label: { en: "Date of submission", bn: "জমাদানের তারিখ" } },
  ],
  fileName: (v, lang) => (lang === "bn" ? "assignment-cover" : "assignment-cover-page"),
  render(v, lang) {
    const bn = lang === "bn";
    const course = [v.courseCode?.trim(), v.courseTitle?.trim()].filter(Boolean).join(": ");
    const teacherLines: Run[][] = [
      [{ text: or(v.teacher, bn ? "শিক্ষকের নাম" : "teacher’s name"), bold: true }],
      ...[v.teacherTitle?.trim(), v.department?.trim(), v.institution?.trim()].filter((x): x is string => !!x).map((text) => [{ text }]),
    ];
    const studentLines: Run[][] = [
      [{ text: or(v.name, bn ? "তোমার নাম" : "your name"), bold: true }],
      [{ text: `${bn ? "রোল / আইডি" : "ID"}: ${or(v.studentId, bn ? "রোল" : "ID")}` }],
      ...(v.batch?.trim() ? [[{ text: v.batch.trim() }]] : []),
      ...(v.department?.trim() && !bn ? [[{ text: v.department.trim() }]] : []),
    ];
    return [
      ...(v.logo ? [{ t: "image" as const, src: v.logo, width: 84, gap: 6 }] : []),
      p(or(v.institution, bn ? "প্রতিষ্ঠানের নাম" : "University or college"), { align: "center", bold: true, size: 20, gap: v.logo ? 12 : 30 }),
      ...(v.department?.trim() ? [p(v.department.trim(), { align: "center", size: 13, gap: 4 })] : []),
      p(bn ? "অ্যাসাইনমেন্ট" : "ASSIGNMENT", { align: "center", bold: true, size: 17, gap: 54 }),
      p(`${bn ? "বিষয়" : "Course"}: ${course || (bn ? "[বিষয়]" : "[course]")}`, { align: "center", size: 13, gap: 10 }),
      p(bn ? "শিরোনাম" : "Topic", { align: "center", size: 11, gap: 26 }),
      p(or(v.title, bn ? "অ্যাসাইনমেন্টের শিরোনাম" : "assignment title"), { align: "center", bold: true, size: 15, gap: 2 }),
      { t: "cols", gap: 80, cols: [
        { title: bn ? "যার কাছে জমা" : "Submitted to", lines: teacherLines },
        { title: bn ? "জমাদানকারী" : "Submitted by", lines: studentLines },
      ] },
      p(`${bn ? "জমাদানের তারিখ" : "Date of submission"}: ${or(longDate(v.date, lang), bn ? "তারিখ" : "date")}`, { align: "center", gap: 70 }),
    ];
  },
};

export const TEMPLATES: TemplateDef[] = [leave, certificate, coverLetter, coverPage];

export function getTemplate(slug: string): TemplateDef {
  const t = TEMPLATES.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown template: ${slug}`);
  return t;
}

/** Starting values for a form: each field's initial value, "today" as today's date, then anything remembered. */
export function initialValues(t: TemplateDef, today: string, remembered: Values = {}): Values {
  const v: Values = {};
  for (const fd of t.fields) {
    const start = fd.initial === "today" ? today : fd.initial ?? "";
    v[fd.key] = fd.shared && remembered[fd.key] ? remembered[fd.key] : start;
  }
  return v;
}

/** The document as plain text, for copying into an email or a form. */
export function blocksToText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.gap && out.length) out.push("");
    if (b.t === "p") out.push(b.runs.map((r) => r.text).join(""));
    else if (b.t === "bullets") out.push(...b.items.map((i) => `• ${i}`));
    else if (b.t === "cols") for (const c of b.cols) out.push(c.title, ...c.lines.map((l) => l.map((r) => r.text).join("")), "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
