"use client";

/*
 * Floating "Ask AI Tutor" button on the home page. Hidden over the hero; slides in once the hero has scrolled
 * out of view, and opens the AI Tutor page. Place it inside the hero section (which must be position: relative):
 * it watches a 1px marker at the hero's bottom edge.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AI_PAGE, Sparkle } from "@/components/ai/shared";
import { useIsClient } from "@/lib/useLocal";

export function AiTutorButton() {
  const marker = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const mounted = useIsClient();

  useEffect(() => {
    const el = marker.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <span ref={marker} aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-px w-px" />
      {/* on <body>: the hero is its own stacking layer (isolate), which would let later sections paint over it */}
      {mounted && createPortal(
        <Link href={AI_PAGE} aria-hidden={!show} tabIndex={show ? 0 : -1}
          className={"group fixed right-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-route pr-5 pl-3.5 font-semibold text-route-ink shadow-[0_10px_30px_rgba(124,149,255,.35)] transition duration-300 hover:brightness-110 hover:shadow-[0_14px_40px_rgba(124,149,255,.55)] focus-visible:shadow-[0_14px_40px_rgba(124,149,255,.55)] motion-safe:hover:scale-105 motion-safe:active:scale-95 print:hidden max-sm:size-14 max-sm:justify-center max-sm:p-0 " +
            (show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
          {/* hover: a soft shine sweeps across once */}
          <span aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-2/3 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0 group-hover:opacity-100 motion-safe:group-hover:translate-x-[320%] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out" />
          {/* hover: the sparkle rolls half a turn and grows a little */}
          <span className="relative grid place-items-center motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(.34,1.56,.64,1)] motion-safe:group-hover:scale-125 motion-safe:group-hover:rotate-180 motion-safe:group-focus-visible:rotate-180">
            <Sparkle size={20} />
          </span>
          <span className="relative max-sm:sr-only">Ask AI Tutor</span>
        </Link>,
        document.body,
      )}
    </>
  );
}
