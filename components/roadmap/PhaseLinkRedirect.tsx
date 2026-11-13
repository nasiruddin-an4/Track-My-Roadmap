"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Older links pointed at a phase on this page (#phase-3, #career); the tracker now lives at /track. */
export function PhaseLinkRedirect({ slug }: { slug: string }) {
  const router = useRouter();
  useEffect(() => {
    const h = location.hash.replace(/^#/, "");
    if (/^phase-\d+$/.test(h) || h === "career" || h === "always") router.replace(`/roadmaps/${slug}/track#${h}`);
  }, [router, slug]);
  return null;
}
