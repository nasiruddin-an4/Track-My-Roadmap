"use client"; // error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

/** Shown instead of a blank page when something on a page crashes. Progress is saved as you go, so nothing is lost. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="wrap grid min-h-[70svh] place-items-center py-16">
      <div className="grid w-full max-w-[520px] justify-items-start gap-5 rounded-[22px] border border-line bg-surface p-7 sm:p-9">
        <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-bg/60 px-3 py-1">
          <span className="size-1.5 rounded-full bg-danger" /> Something went wrong
        </span>
        <h1 className="m-0 font-display text-[clamp(1.7rem,4.5vw,2.3rem)] leading-tight font-bold tracking-[-.03em]">
          We hit a <span className="text-highlight">bump</span> in the road.
        </h1>
        <p className="m-0 text-muted">
          This page ran into a problem. Your progress is saved as you go, so nothing is lost. Try again, or head back home.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="btn primary">Try again</button>
          <Link href="/" className="btn">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
