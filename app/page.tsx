import Image from "next/image";
import Link from "next/link";
import { AiTutorButton } from "@/components/home/AiTutorButton";
import { HeroBackdrop } from "@/components/home/HeroArt";
import { LegacyRedirect } from "@/components/home/LegacyRedirect";
import { RoadmapFinder } from "@/components/home/RoadmapFinder";
import { Arrow, Check } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolCard } from "@/components/tools/ToolCard";
import { FEATURED_ROADMAP_SLUGS, ROADMAPS } from "@/content/roadmaps";
import { topicCount } from "@/lib/roadmap";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getTool, TOOLS } from "@/lib/tools/registry";

const HOME_TOOLS = ["photo-signature-resizer", "compress-image", "merge-pdf", "bijoy-unicode-converter"];

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: "Free tech career roadmaps, topic-by-topic progress tracking, and daily habit tools.",
};

const STEPS = [
  { t: "Pick a roadmap", d: "Choose a career path. Each one is split into phases, from the basics to job-ready, in the order you should learn them." },
  { t: "Tick topics as you learn", d: "Mark each topic done. Your progress fills in phase by phase, and finished phases turn green." },
  { t: "Always know what’s next", d: "Up next shows the very next topic to learn, so you never have to work out where you left off." },
];

const FEATURES: { t: string; d: string; icon: React.ReactNode }[] = [
  { t: "Up next", d: "The next topic on your route, one tap to mark it done.", icon: <path d="M5 12h14M13 6l6 6-6 6" /> },
  { t: "Search every topic", d: "Find any topic across all phases and tick it off from the results.", icon: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></> },
  { t: "Daily habit tracker", d: "Build the habits that keep you learning, with monthly progress, streaks, mood and motivation.", icon: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M8 15l2 2 4-4" /></> },
  { t: "Synced to your Google account", d: "Sign in with Google and your progress follows you to your phone, laptop and every other device.", icon: <path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8.5 4 4 0 0 1 17.5 18H7z" /> },
  { t: "Made for your phone", d: "The route turns into a swipeable strip on small screens, so you can tick topics on the go.", icon: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></> },
  { t: "Optional and advanced topics", d: "Nice-to-haves are marked, so you can focus on what matters and come back for the deep end later.", icon: <><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8" r="1.4" /></> },
];

const CREATOR = [
  "Build your own roadmap for a course or a class",
  "Draft it in minutes with AI, then edit it",
  "Share it free, or charge for it",
  "See how your students progress, phase by phase",
];

const FAQ: [string, React.ReactNode][] = [
  ["Is it free?", "Yes. Every roadmap, the habit tracker and the student tools are free to use."],
  ["Do I need an account?", "You can read every roadmap without one. To track your progress, sign in with Google. It’s free, and your progress is then saved to your account."],
  ["Where is my progress saved?", "In your Google-linked account, so it’s the same on every device you sign in on. Only you can see it."],
  ["Who writes the roadmaps?", <>The Software Engineer roadmap is based on the 2026–2030 Software Engineering roadmap by Ittahaduzzaman Akash on roadmap.sh. More roadmaps are on the way, and soon teachers will be able to publish their own.</>],
  ["Can I use it on my phone?", "Yes. It works in any phone browser. For Google sign-in, open the link in Chrome or Safari rather than inside an app like Messenger."],
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA).replace(/</g, "\\u003c") }}
      />
      <LegacyRedirect />

      {/* hero */}
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop />
        <AiTutorButton />
        <div className="wrap grid grid-cols-[minmax(0,1fr)] items-center gap-14 pt-16 pb-[68vw] sm:pt-20 md:pb-24 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:pt-28 lg:pb-36">
          <div className="grid gap-7">
            <span className="flex items-center gap-3 font-mono text-[.8rem] font-medium tracking-[.18em] text-ink uppercase">
              <svg width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="#FF5A00" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 2 10l5 6M19 4l5 6-5 6M15 2l-4 16" /></svg>
              Career roadmaps &amp; habit tracker
            </span>
            <h1 className="m-0 font-display text-[clamp(2.5rem,5.2vw,4.1rem)] leading-[1.06] font-bold tracking-[-.035em]">
              <span className="block text-balance xl:whitespace-nowrap">Know what to learn next.</span>
              <span className="block text-balance text-highlight xl:whitespace-nowrap">Show up every day.</span>
            </h1>
            <p className="m-0 max-w-[46ch] text-[clamp(1.08rem,1.6vw,1.3rem)] leading-relaxed text-muted">
              Follow a step-by-step roadmap for your tech career, tick off every topic as you learn it, and keep
              the daily habits that get you there. Free, and saved to your Google account.
            </p>
            <div className="grid gap-3 pt-1 sm:flex sm:flex-wrap">
              {/* hover: a shine sweeps across, the button lifts and the arrow slides on (no movement with reduced motion) */}
              <Link href="#roadmaps"
                className="btn primary group relative overflow-hidden !min-h-14 !rounded-[14px] !px-7 !text-[1.05rem] transition duration-300 hover:shadow-[0_12px_32px_rgba(124,149,255,.4)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0">
                <span aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-2/3 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 group-hover:opacity-100 motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:translate-x-[320%]" />
                <span className="relative">Choose a roadmap</span>
                <span className="relative motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:translate-x-1"><Arrow size={18} /></span>
              </Link>
              {/* hover: the calendar rolls a little (with a bounce), the button lifts and lights up */}
              <Link href="/habits" prefetch
                className="btn group !min-h-14 !rounded-[14px] !border-muted/50 !bg-transparent !px-6 !text-[1.05rem] transition duration-300 hover:!border-ink hover:!bg-white/[.05] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0">
                <span className="grid place-items-center motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(.34,1.56,.64,1)] motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-115 group-hover:text-[#FF5A00]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /><rect x="7.5" y="13" width="3" height="3" rx=".6" /></svg>
                </span>
                Start the habit tracker
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* roadmaps */}
      <section id="roadmaps" aria-labelledby="mapsH" className="scroll-mt-16 bg-band py-20 sm:py-24">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <SectionHead eyebrow="Roadmaps" id="mapsH" title="Choose your roadmap" />
            <p className="m-0 max-w-[58ch] text-[.95rem] leading-relaxed text-muted">
              Explore free software engineer, frontend developer, AI engineer, and other tech career roadmaps.
              Track topics as you learn and build steady study habits.
            </p>
          </div>
          <RoadmapFinder roadmaps={ROADMAPS.map((roadmap) => ({
            slug: roadmap.def.slug,
            title: roadmap.def.title,
            tagline: roadmap.def.tagline,
            category: roadmap.def.category,
            phases: roadmap.numbered.length,
            topics: topicCount(roadmap),
            featured: FEATURED_ROADMAP_SLUGS.includes(roadmap.def.slug),
          }))} />
        </div>
      </section>

      {/* how it works */}
      <section aria-labelledby="howH" className="wrap py-20 sm:py-24">
        <SectionHead eyebrow="How it works" id="howH" title="A clear route instead of a pile of tutorials" />
        <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative grid content-start gap-3 rounded-[20px] border border-line bg-surface p-6">
              <span className={"grid size-10 place-items-center rounded-full border-2 font-mono text-[.9rem] font-medium " +
                (i === 0 ? "border-done bg-done text-bg" : i === 1 ? "border-route bg-route text-bg shadow-[0_0_0_4px_var(--route-soft)]" : "border-line text-muted")}>
                {i === 0 ? <Check size={16} /> : i + 1}
              </span>
              <h3 className="m-0 font-display text-[1.3rem] font-bold tracking-[-.02em]">{s.t}</h3>
              <p className="m-0 text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* features */}
      <section aria-labelledby="featH" className="border-t border-line bg-[linear-gradient(180deg,var(--surface),transparent_70%)]">
        <div className="wrap py-20 sm:py-24">
          <SectionHead eyebrow="What you get" id="featH" title="Everything you need to stay on track" />
          <ul className="m-0 mt-10 grid list-none gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.t} className="grid content-start gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-route-soft text-route">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{f.icon}</svg>
                </span>
                <h3 className="m-0 font-display text-[1.15rem] font-bold tracking-[-.01em]">{f.t}</h3>
                <p className="m-0 text-muted">{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* student tools */}
      <section aria-labelledby="toolsH" className="wrap pb-20 sm:pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Student tools" id="toolsH" title="Free tools for forms and assignments" />
          <p className="m-0 max-w-[52ch] text-[.95rem] leading-relaxed text-muted">
            Resize your photo and signature for job and admission forms, shrink images and PDFs for upload, and convert
            Bijoy to Unicode. No sign-up, and your files never leave your device.
          </p>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_TOOLS.map((slug) => <li key={slug}><ToolCard tool={getTool(slug)} compact /></li>)}
        </ul>
        <Link href="/tools" className="mt-5 inline-flex items-center gap-1.5 text-[.95rem] font-semibold text-route hover:underline">
          See all {TOOLS.length} tools <Arrow size={14} />
        </Link>
      </section>

      {/* creators */}
      <section aria-labelledby="creatorH" className="wrap pb-20 sm:pb-24">
        <div className="grid gap-10 overflow-hidden rounded-[28px] border border-line bg-surface p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="grid gap-4">
            <span className="w-fit rounded-full bg-[rgba(242,164,98,.14)] px-3 py-1 text-[.8rem] font-semibold text-warm">Coming soon · For teachers and creators</span>
            <h2 id="creatorH" className="m-0 font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.05] font-bold tracking-[-.03em] text-balance">
              Turn your course into a roadmap your students can follow
            </h2>
            <p className="m-0 max-w-[48ch] text-muted">
              Soon you’ll be able to publish your own roadmaps on Track My Roadmap and help students learn in the right order.
            </p>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0">
            {CREATOR.map((c) => (
              <li key={c} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-4 py-3.5">
                <span className="grid size-7 flex-none place-items-center rounded-full bg-route-soft text-route"><Check size={14} /></span>
                <span className="font-medium">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* faq */}
      <section aria-labelledby="faqH" className="wrap grid gap-10 pb-20 sm:pb-24 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start"><SectionHead eyebrow="Questions" id="faqH" title="Good to know" /></div>
        <div className="grid">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-line py-1 first:border-t">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-display text-[1.1rem] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid size-8 flex-none place-items-center rounded-full bg-sunk text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </summary>
              <p className="m-0 max-w-[62ch] pb-5 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final call */}
      <section className="wrap">
        <div className="relative isolate grid items-center gap-10 overflow-hidden rounded-[28px] border border-line bg-band px-6 py-14 sm:px-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div aria-hidden="true" className="absolute -top-24 -right-16 -z-10 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,138,0,.28),transparent)] blur-2xl" />
          <div className="grid gap-5">
            <span className="eyebrow">Free · Sign in with Google</span>
            <h2 className="m-0 max-w-[16ch] font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.04] font-bold tracking-[-.035em] text-balance">
              Your next step is <span className="text-highlight">one tick away.</span>
            </h2>
            <p className="m-0 max-w-[50ch] text-[1.08rem] leading-relaxed text-muted">
              Pick a roadmap and mark what you already know, or start today’s habits. Your progress is saved to your
              Google account and follows you to every device.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/roadmaps" prefetch className="btn primary !min-h-12 !rounded-[12px] !px-6 !text-base">Choose a roadmap <Arrow /></Link>
              <Link href="/habits" prefetch className="btn !min-h-12 !rounded-[12px] !border-muted/50 !bg-transparent !px-5 !text-base hover:!border-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /><rect x="7.5" y="13" width="3" height="3" rx=".6" /></svg>
                Start the habit tracker
              </Link>
            </div>
          </div>
          <Image src="/brand/icon-560.png" alt="" width={560} height={560} sizes="200px" aria-hidden="true"
            className="hidden size-[200px] drop-shadow-[0_20px_40px_rgba(255,90,0,.35)] lg:block" />
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function SectionHead({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="grid content-start gap-3">
      <span className="eyebrow">{eyebrow}</span>
      <h2 id={id} className="m-0 max-w-[20ch] font-display text-[clamp(1.9rem,4.4vw,2.9rem)] leading-[1.04] font-bold tracking-[-.035em] text-balance">{title}</h2>
    </div>
  );
}
