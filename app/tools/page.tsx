import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolCard } from "@/components/tools/ToolCard";
import { OnDevice } from "@/components/tools/ToolPage";
import { pageMeta } from "@/lib/site";
import { TOOL_GROUPS, TOOLS } from "@/lib/tools/registry";

export const metadata: Metadata = {
  ...pageMeta(
    "Free Student Tools: Photo Resizer, PDF and Bijoy Converter",
    "Free tools for students in Bangladesh: resize photos and signatures for job and admission forms, compress images to 100 KB, merge, split and compress PDFs, and convert Bijoy to Unicode. No sign-up, and files never leave your device.",
    "/tools",
  ),
  keywords: ["student tools", "photo resizer", "signature resizer", "compress image to 100kb", "merge pdf", "compress pdf", "bijoy to unicode", "ছবি রিসাইজ", "পিডিএফ টুল"],
};

const WHY: { t: string; d: string; icon: React.ReactNode }[] = [
  { t: "Your files stay with you", d: "Every tool except the AI note reader runs inside your browser. Nothing is uploaded, so certificates and ID photos stay private.", icon: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  { t: "No account needed", d: "Open a tool and use it. Sign in (free) only to work on more than 10 files at a time, or to use the AI note reader.", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></> },
  { t: "Made for your phone", d: "Big buttons, camera upload and fast even on mobile data, since your files don’t travel anywhere.", icon: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></> },
];

/** The student tools, grouped. Public; no sign-in. */
export default function ToolsPage() {
  return (
    <>
      <div className="wrap">
        <header className="relative isolate grid gap-4 pt-12 pb-10 sm:pt-16">
          <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 -z-10 size-[420px] rounded-full bg-highlight/10 blur-[110px]" />
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-[45%] -z-10 size-[300px] rounded-full bg-route/15 blur-[110px]" />
          <span className="eyebrow">Student tools</span>
          <h1 className="m-0 max-w-[20ch] font-display text-[clamp(2.3rem,5.4vw,3.6rem)] leading-[1.02] font-bold tracking-[-.035em] text-balance">
            Free tools for <span className="text-highlight">forms, assignments</span> and Bangla
          </h1>
          <p className="m-0 max-w-[60ch] text-[1.08rem] leading-relaxed text-muted">
            Get your photo and signature to the exact size a form wants, write a leave application or a cover page,
            shrink images and PDFs for upload, turn handwritten notes into a quiz, and convert Bijoy text to Unicode.
          </p>
          <p lang="bn" className="m-0 text-muted">ছবি ও স্বাক্ষর রিসাইজ, আবেদনপত্র, PDF টুল ও বিজয়-ইউনিকোড কনভার্টার, সম্পূর্ণ ফ্রি।</p>
          <OnDevice className="mt-1" text="Free · All but the AI note reader work on your device, with no upload" />
        </header>

        <Link href="/tools/photo-signature-resizer"
          className="group mb-12 grid gap-5 overflow-hidden rounded-[24px] border border-line bg-band p-6 transition-colors hover:border-highlight sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
          <span className="grid gap-2">
            <span className="w-fit rounded-full bg-[rgba(255,90,0,.14)] px-3 py-1 text-[.8rem] font-semibold text-highlight">Most used</span>
            <span className="font-display text-[clamp(1.5rem,3.4vw,2.1rem)] leading-tight font-bold tracking-[-.025em]">Photo and signature resizer</span>
            <span className="max-w-[56ch] text-muted">
              300 × 300 photo under 100 KB and 300 × 80 signature under 60 KB for government job forms, plus Dhaka University
              admission, passport size, or any size your circular asks for.
            </span>
          </span>
          <span className="btn big w-fit">Resize now <Arrow /></span>
        </Link>

        <div className="grid gap-12">
          {TOOL_GROUPS.map((g) => {
            const list = TOOLS.filter((t) => t.group === g.key);
            return (
              <section key={g.key} aria-labelledby={`g-${g.key}`} className="grid gap-4">
                <div className="grid gap-1">
                  <h2 id={`g-${g.key}`} className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">{g.title}</h2>
                  <p className="m-0 text-muted">{g.text}</p>
                </div>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => <li key={t.slug}><ToolCard tool={t} /></li>)}
                </ul>
              </section>
            );
          })}
        </div>

        <section aria-labelledby="whyH" className="mt-16 border-t border-line pt-14">
          <h2 id="whyH" className="m-0 font-display text-[1.8rem] font-bold tracking-[-.025em]">Why students use these</h2>
          <ul className="m-0 mt-8 grid list-none gap-x-8 gap-y-8 p-0 sm:grid-cols-3">
            {WHY.map((w) => (
              <li key={w.t} className="grid content-start gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-done-soft text-done">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{w.icon}</svg>
                </span>
                <h3 className="m-0 font-display text-[1.15rem] font-bold">{w.t}</h3>
                <p className="m-0 text-muted">{w.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 grid gap-6 rounded-[24px] border border-line bg-surface p-7 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="grid gap-2">
            <h2 className="m-0 font-display text-[clamp(1.5rem,3.4vw,2.1rem)] leading-tight font-bold tracking-[-.03em]">Forms done. What are you learning next?</h2>
            <p className="m-0 max-w-[56ch] text-muted">Follow a free, step-by-step roadmap for a tech career, and tick off each topic as you learn it.</p>
          </div>
          <Link href="/roadmaps" className="btn primary !min-h-12 w-fit !px-6">Browse roadmaps <Arrow /></Link>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
