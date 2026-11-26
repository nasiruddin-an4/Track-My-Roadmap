"use client";

import { useEffect } from "react";

/** Tools opened on this device, newest first, for "Recently used" on /tools. Kept in the browser only. */
export const RECENT_TOOLS_KEY = "tmr-tools-recent";

export function RememberTool({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) ?? "[]") as unknown;
      const prev = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string" && x !== slug) : [];
      localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify([slug, ...prev].slice(0, 6)));
    } catch {}
  }, [slug]);
  return null;
}
