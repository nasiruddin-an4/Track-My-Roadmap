"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Links shared from the old one-page site (/#phase-3, /#career, /#habits) still land in the right place. */
export function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const h = location.hash.replace(/^#/, "");
    if (h === "habits") router.replace("/habits/track");
    else if (h === "roadmap") router.replace("/roadmaps/software-engineer/track");
    else if (/^phase-\d+$/.test(h) || h === "career" || h === "always") router.replace("/roadmaps/software-engineer/track#" + h);
  }, [router]);
  return null;
}
