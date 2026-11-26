import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolsExplorer, type ExplorerTool } from "@/components/tools/ToolsExplorer";
import { pageMeta } from "@/lib/site";
import { POPULAR_TOOLS, TOOL_GROUPS, TOOLS } from "@/lib/tools/registry";

export const metadata: Metadata = {
  ...pageMeta(
    "Free Online Tools: Photo Resizer, PDF Tools, Letters and Bijoy to Unicode",
    "Free tools for everyday paperwork in Bangladesh: resize photos and signatures for job and admission forms, compress images to 100 KB, merge, split and compress PDFs, write applications and cover letters, and convert Bijoy to Unicode. No sign-up, and files stay on your device.",
    "/tools",
  ),
  keywords: ["free online tools", "photo resizer", "signature resizer", "compress image to 100kb", "merge pdf", "compress pdf", "leave application", "cover letter", "bijoy to unicode", "ছবি রিসাইজ", "পিডিএফ টুল", "বিজয় থেকে ইউনিকোড"],
};

// tools from the registry, plus the CV builder, which people look for here too
const LIST: ExplorerTool[] = [
  ...TOOLS.map((t) => ({
    slug: t.slug, name: t.name, summary: t.summary, bn: t.bn, group: t.group, keywords: t.keywords,
    badge: t.onDevice === false ? "AI · sign-in" : undefined,
  })),
  {
    slug: "cv-builder", href: "/cv", name: "CV builder", group: "templates", badge: "Sign-in",
    summary: "An ATS-friendly CV in English or Bangla, as PDF or Word.", bn: "বাংলা বা ইংরেজিতে সিভি তৈরি করুন",
    keywords: ["cv", "resume", "biodata", "job", "ats", "সিভি", "জীবনবৃত্তান্ত"],
  },
];

const PERKS: { t: string; icon: React.ReactNode }[] = [
  { t: "No sign-up", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></> },
  { t: "Files stay on your device", icon: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  { t: "Works on your phone", icon: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></> },
  { t: "English and বাংলা", icon: <><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" /></> },
];

const FAQ: [string, React.ReactNode][] = [
  ["Are these tools really free?", "Yes. There’s no sign-up, no watermark and no limit on how often you use them. Signing in (free) only lets you work on more than 10 files at once, and turns on the AI note reader and the CV builder."],
  ["Are my files uploaded anywhere?", "No. Every tool except the AI note reader works inside your browser, on your own phone or computer, so photos, certificates and PDFs never reach our server. That also makes them fast on slow connections."],
  ["Do they work on a phone?", "Yes. Open them in Chrome or Safari on your phone. You can pick photos from your gallery or take one with the camera."],
  ["Which photo size does my form need?", <>Most government job forms on Teletalk want a 300 × 300 photo under 100 KB and a 300 × 80 signature under 60 KB. Check your circular, then use the <Link href="/tools/photo-signature-resizer" className="font-semibold text-route hover:underline">photo and signature resizer</Link>; it has the common sizes built in and a custom size for the rest.</>],
];

/** Every free tool, with search and categories. Public; no sign-in. */
export default function ToolsPage() {
  return (
    <>
      <div className="wrap">
        <header className="relative isolate grid gap-5 pt-12 pb-8 sm:pt-16 sm:pb-10">
          <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 -z-10 size-[420px] rounded-full bg-highlight/10 blur-[110px]" />
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-[45%] -z-10 size-[320px] rounded-full bg-route/15 blur-[110px]" />
          <span className="eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 backdrop-blur">
            <span className="size-1.5 rounded-full bg-done shadow-[0_0_0_3px_rgba(67,211,153,.2)]" />
            {LIST.length} free tools
          </span>
          <h1 className="m-0 max-w-[18ch] font-display text-[clamp(2.3rem,5.4vw,3.7rem)] leading-[1.02] font-bold tracking-[-.035em] text-balance">
            Free tools for photos, PDFs and <span className="text-highlight">everyday paperwork</span>
          </h1>
          <p className="m-0 max-w-[60ch] text-[1.08rem] leading-relaxed text-muted">
            Resize a photo for a job form, shrink or merge a PDF, write an application, or convert Bijoy to Unicode.
            Pick a tool and get it done in a minute.
          </p>
          <p lang="bn" className="m-0 text-muted">ছবি রিসাইজ, PDF টুল, আবেদনপত্র ও বিজয়-ইউনিকোড কনভার্টার, সম্পূর্ণ ফ্রি।</p>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[.92rem]">
            {PERKS.map((p) => (
              <li key={p.t} className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-done-soft text-done">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p.icon}</svg>
                </span>
                {p.t}
              </li>
            ))}
          </ul>
        </header>

        <ToolsExplorer tools={LIST} groups={TOOL_GROUPS} popular={POPULAR_TOOLS} />

        <section aria-labelledby="faqH" className="mt-20 grid gap-8 border-t border-line pt-14 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <div className="grid content-start gap-3">
            <span className="eyebrow">Questions</span>
            <h2 id="faqH" className="m-0 font-display text-[1.8rem] font-bold tracking-[-.025em]">Good to know</h2>
          </div>
          <div className="grid">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group border-b border-line py-1 first:border-t">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="grid size-7 flex-none place-items-center rounded-full bg-sunk text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                </summary>
                <p className="m-0 max-w-[62ch] pb-4 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-3 rounded-[22px] border border-line bg-surface p-6 sm:p-8">
            <h2 className="m-0 font-display text-[1.35rem] font-bold tracking-[-.02em]">Missing a tool?</h2>
            <p className="m-0 text-muted">Tell us what you need to get done, and we’ll look at adding it.</p>
            <a href="#feedback" className="btn w-fit">Suggest a tool</a>
          </div>
          <div className="grid content-start gap-3 rounded-[22px] border border-line bg-band p-6 sm:p-8">
            <h2 className="m-0 font-display text-[1.35rem] font-bold tracking-[-.02em]">Learning a tech skill?</h2>
            <p className="m-0 text-muted">Follow a free, step-by-step roadmap and tick off each topic as you learn it.</p>
            <Link href="/roadmaps" className="btn primary w-fit">Browse roadmaps <Arrow /></Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
