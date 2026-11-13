import type { Metadata } from "next";
import { HabitsPreview } from "@/components/habits/HabitsPreview";
import { HabitsStart } from "@/components/habits/HabitsStart";
import { MonthlyProgress } from "@/components/habits/MonthlyProgress";
import { Check } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { DEFAULT_HABITS } from "@/lib/habits";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "Free Daily Habit Tracker",
  "A free daily habit tracker for learners: tick off today’s habits, keep your streak, see your month fill in, and track mood and motivation. Synced to Google.",
  "/habits",
);

const FEATURES: { t: string; d: string; icon: React.ReactNode }[] = [
  { t: "Today’s checklist", d: "Every habit for today in one list. Tick them off as you go.", icon: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12 2.5 2.5 4.5-5" /></> },
  { t: "Your month at a glance", d: "A progress ring with your goal, what’s done and what’s left this month.", icon: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 8 8" strokeWidth="3" /></> },
  { t: "Daily and weekly charts", d: "See which days and weeks went well, with your average and best day.", icon: <><path d="M5 20V11M10 20V6M15 20v-7M20 20V9" /></> },
  { t: "The full month grid", d: "Every habit against every day of the month, so streaks and gaps are easy to spot.", icon: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M9 10v10.5M14.5 10v10.5" /></> },
  { t: "Mood and motivation", d: "Score each day from 0 to 10, or let it fill in from your habits, and watch the trend.", icon: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></> },
  { t: "Your own habits", d: "Keep the starter routine or make your own. Add, remove and use emoji.", icon: <><path d="M12 5v14M5 12h14" /></> },
];

/** Public overview of the habit tracker; "Start tracking" signs people in first. */
export default function HabitsPage() {
  return (
    <>
    <div className="wrap">
      <header className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 lg:pb-20">
        <div className="grid gap-6">
          <span className="eyebrow">Habit tracker</span>
          <h1 className="m-0 max-w-[15ch] font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[1] font-bold tracking-[-.04em] text-balance">
            Build the daily habits that <span className="text-highlight">get you there</span>.
          </h1>
          <p className="m-0 max-w-[50ch] text-[1.12rem] leading-relaxed text-muted">
            Learning a career takes showing up every day. Tick off today’s habits, watch your month fill in,
            and keep an eye on your mood and motivation along the way.
          </p>
          <HabitsStart />
        </div>
        <HabitsPreview />
      </header>

      <section aria-labelledby="monthH" className="border-t border-line py-16 sm:py-20">
        <div className="mb-10 grid gap-3">
          <span className="eyebrow">Your month at a glance</span>
          <h2 id="monthH" className="m-0 max-w-[22ch] font-display text-[clamp(1.9rem,4.4vw,2.8rem)] leading-[1.04] font-bold tracking-[-.035em] text-balance">
            Tick a little every day and watch your month fill in
          </h2>
          <p className="m-0 max-w-[58ch] text-muted">
            Each day turns greener as you complete more habits. Keep your streak alive, aim for perfect days,
            and see which habits are sticking.
          </p>
        </div>
        <MonthlyProgress />
      </section>

      <section aria-labelledby="insideH" className="border-t border-line py-16 sm:py-20">
        <div className="grid gap-3">
          <span className="eyebrow">What’s inside</span>
          <h2 id="insideH" className="m-0 max-w-[20ch] font-display text-[clamp(1.9rem,4.4vw,2.8rem)] leading-[1.04] font-bold tracking-[-.035em] text-balance">Everything you need to keep the streak going</h2>
        </div>
        <ul className="m-0 mt-10 grid list-none gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.t} className="grid content-start gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-done-soft text-done">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{f.icon}</svg>
              </span>
              <h3 className="m-0 font-display text-[1.15rem] font-bold tracking-[-.01em]">{f.t}</h3>
              <p className="m-0 text-muted">{f.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="starterH" className="grid gap-8 rounded-[24px] border border-line bg-surface p-7 sm:p-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div className="grid content-start gap-3">
          <span className="eyebrow">Starter routine</span>
          <h2 id="starterH" className="m-0 font-display text-[clamp(1.6rem,3.6vw,2.2rem)] leading-tight font-bold tracking-[-.03em]">Start with a ready-made day</h2>
          <p className="m-0 text-muted">Your tracker begins with these {DEFAULT_HABITS.length} habits. Remove any you don’t need and add your own.</p>
        </div>
        <ul className="m-0 flex list-none flex-wrap content-start gap-2 p-0">
          {DEFAULT_HABITS.map((h) => <li key={h} className="rounded-full border border-line bg-bg px-3 py-1 text-[.9rem]">{h}</li>)}
        </ul>
      </section>

      <section className="mt-16 grid gap-6 rounded-[24px] border border-line bg-surface p-7 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="grid gap-2">
          <h2 className="m-0 font-display text-[clamp(1.6rem,3.6vw,2.2rem)] leading-tight font-bold tracking-[-.03em]">Ready to start?</h2>
          <ul className="m-0 grid list-none gap-1.5 p-0 text-muted">
            {["Free to use", "Saved to your Google account", "Works on your phone"].map((x) => (
              <li key={x} className="flex items-center gap-2"><span className="text-done"><Check size={14} /></span>{x}</li>
            ))}
          </ul>
        </div>
        <HabitsStart note={false} />
      </section>
    </div>
    <SiteFooter />
    </>
  );
}
