import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { FEATURED_ROADMAP_SLUGS, ROADMAPS } from "@/content/roadmaps";
import { topicCount } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/** Shown for any unknown address (and for /admin to non-admins): a lost-route illustration and ways back on track. */
export default function NotFound() {
  const featured = FEATURED_ROADMAP_SLUGS.map((slug) => ROADMAPS.find((r) => r.def.slug === slug)).filter((r) => r !== undefined);

  return (
    <>
      <main className="relative isolate overflow-hidden">
        <span aria-hidden="true" className="pointer-events-none absolute -top-32 -left-32 -z-10 size-115 rounded-full bg-route/15 blur-[120px]" />
        <span aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 -z-10 size-95 rounded-full bg-highlight/10 blur-[120px]" />

        <div className="wrap grid items-center gap-8 py-10 sm:gap-12 sm:py-14 lg:min-h-[calc(100svh-var(--top))] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-16 lg:py-20">
          <div className="grid content-center gap-6">
            <span className="eyebrow inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1">
              <span className="size-1.5 rounded-full bg-highlight shadow-[0_0_0_3px_rgba(255,90,0,.2)]" />
              Error 404 · Page not found
            </span>
            <h1 className="m-0 font-display text-[clamp(2.3rem,5.6vw,3.8rem)] leading-[1.02] font-bold tracking-[-.035em] text-balance">
              This road isn’t on the <span className="text-highlight">map</span>.
            </h1>
            <p className="m-0 max-w-[50ch] text-[1.06rem] leading-relaxed text-muted">
              The page you’re looking for was moved, renamed, or never existed. No progress was lost. Pick a route below
              to get back on track.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="inline-flex h-12 items-center gap-2 rounded-xl bg-route px-5 font-semibold text-route-ink transition hover:brightness-110">
                Back to home <Arrow />
              </Link>
              <Link href="/roadmaps" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface/60 px-5 font-semibold text-ink transition hover:border-muted">
                Browse all roadmaps
              </Link>
            </div>

            {featured.length > 0 && (
              <nav aria-labelledby="nf-popular" className="mt-2 grid gap-3">
                <span id="nf-popular" className="eyebrow">Popular routes</span>
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                  {featured.map((rm) => (
                    <li key={rm.def.slug}>
                      <Link href={`/roadmaps/${rm.def.slug}`}
                        className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3 transition-colors hover:border-muted">
                        <span className="grid min-w-0 gap-0.5">
                          <b className="truncate text-[.95rem] font-semibold">{rm.def.title}</b>
                          <span className="font-mono text-[.74rem] whitespace-nowrap text-muted">{topicCount(rm)} topics</span>
                        </span>
                        <span className="flex-none text-muted transition group-hover:translate-x-0.5 group-hover:text-ink"><Arrow size={15} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          <LostRoute />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** The brand's winding road runs into a "road closed" barrier; a faint trail leads on to a question-mark pin. */
function LostRoute() {
  const road = "M-10 372 C 100 372, 118 282, 200 270 S 300 252, 338 252";
  return (
    <div aria-hidden="true" className="relative order-first mx-auto w-full max-w-[min(100%,360px)] sm:max-w-130 lg:order-none">
      <svg viewBox="0 0 520 420" className="block h-auto w-full">
        <defs>
          <linearGradient id="nf-panel" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--band)" />
          </linearGradient>
          <radialGradient id="nf-glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FF5A00" stopOpacity=".4" />
            <stop offset="1" stopColor="#FF5A00" stopOpacity="0" />
          </radialGradient>
          <pattern id="nf-stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="#FF5A00" />
            <rect width="7" height="14" fill="#F1F5F9" />
          </pattern>
          <clipPath id="nf-clip">
            <rect x="10" y="10" width="500" height="400" rx="34" />
          </clipPath>
        </defs>

        {/* map panel */}
        <rect x="10" y="10" width="500" height="400" rx="34" fill="url(#nf-panel)" stroke="var(--line)" />

        <g clipPath="url(#nf-clip)">
          {/* faint terrain contours */}
          <g fill="none" stroke="var(--line)" strokeWidth="1.5" opacity=".55">
            <path d="M-20 120 C 90 70, 170 150, 280 96 S 460 40, 540 86" />
            <path d="M-20 168 C 100 118, 190 196, 300 140 S 470 92, 540 132" opacity=".6" />
            <path d="M180 430 C 250 360, 360 400, 420 330 S 520 300, 560 320" opacity=".7" />
          </g>

          {/* 404, soft, behind everything */}
          <text x="262" y="236" textAnchor="middle" fontFamily="var(--display)" fontWeight="700" fontSize="172" letterSpacing="-6"
            fill="var(--ink)" opacity=".055">404</text>

          {/* the road: shoulder, asphalt, centre line */}
          <path d={road} fill="none" stroke="var(--line)" strokeWidth="44" strokeLinecap="butt" />
          <path d={road} fill="none" stroke="var(--bg)" strokeWidth="38" strokeLinecap="butt" />
          <path d={road} fill="none" stroke="#F1F5F9" strokeWidth="3.5" strokeDasharray="16 13" strokeLinecap="round" opacity=".85" />
        </g>

        {/* road closed */}
        <g>
          <rect x="342" y="208" width="18" height="88" rx="4" fill="url(#nf-stripes)" stroke="var(--bg)" strokeWidth="2" />
          <rect x="340" y="292" width="6" height="14" rx="2" fill="var(--muted)" />
          <rect x="356" y="292" width="6" height="14" rx="2" fill="var(--muted)" />
        </g>

        {/* the way on is unknown */}
        <path d="M374 238 C 398 222, 410 196, 418 172" fill="none" stroke="var(--muted)" strokeWidth="3" strokeDasharray="1 10" strokeLinecap="round" opacity=".7" />

        {/* destination: a pin with a question mark */}
        <circle cx="428" cy="118" r="64" fill="url(#nf-glow)" />
        <path d="M428 70 c-23 0-40 17-40 39 c0 29 40 63 40 63 s40-34 40-63 c0-22-17-39-40-39Z" fill="#FF5A00" />
        <circle cx="428" cy="109" r="22" fill="var(--bg)" />
        <text x="428" y="118.5" textAnchor="middle" fontFamily="var(--display)" fontWeight="700" fontSize="27" fill="#FF8A3D">?</text>
      </svg>
    </div>
  );
}
