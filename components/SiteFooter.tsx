import Link from "next/link";
import { Arrow, Wordmark } from "@/components/icons";

/** Site footer: logo and a one-line pitch, link columns, then credits. `note` adds a page-specific line (e.g. roadmap credit). */
export function SiteFooter({ note }: { note?: string }) {
  return (
    <footer className="mt-20 border-t border-white/10 bg-black text-[.92rem] text-white">
      <div className="wrap py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-[minmax(0,1fr)_minmax(220px,.55fr)] sm:gap-16">
          <div className="grid content-start gap-4">
            <Link
              href="/"
              aria-label="Track My Roadmap, home"
              className="w-fit"
            >
              <Wordmark height={42} onDark />
            </Link>
            <p className="m-0 max-w-[38ch] leading-relaxed text-white/60">
              Clear roadmaps and simple daily habits to help you build a career,
              one step at a time.
            </p>
          </div>

          <nav aria-label="Tools" className="grid content-start gap-3">
            <span className="font-mono text-[.72rem] font-semibold tracking-[.16em] text-white/40 uppercase">
              Explore
            </span>
            <div className="grid gap-2">
              <FooterLink
                href="/roadmaps"
                label="Roadmaps"
                detail="Find your learning path"
              />
              <FooterLink
                href="/habits"
                label="Habit tracker"
                detail="Build your daily routine"
              />
              <FooterLink
                href="/tools"
                label="Free tools"
                detail="Photo resizer, PDF tools, letters, Bijoy to Unicode"
              />
            </div>
          </nav>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-[.82rem] text-white/45">
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            <span>© 2026 Track My Roadmap</span>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <a href="#feedback" className="transition hover:text-white">Feedback</a>
          </span>
          <span>
            Made by{" "}
            <a
              href="https://www.nasiruddin.net/"
              target="_blank"
              rel="noopener"
              className="font-semibold text-white/80 underline-offset-4 transition hover:text-white hover:underline"
            >
              Nasir Uddin
            </a>
          </span>
        </div>
        {note && <p className="m-0 mt-3 text-[.78rem] text-white/40">{note}</p>}
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[.08]"
    >
      <span className="grid gap-0.5">
        <span className="font-semibold text-white/90">{label}</span>
        <span className="text-[.76rem] text-white/45">{detail}</span>
      </span>
      <span className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/90">
        <Arrow size={15} />
      </span>
    </Link>
  );
}
