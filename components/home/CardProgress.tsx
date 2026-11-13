"use client";

import { useMemo } from "react";
import { keyHash } from "@/lib/roadmap";
import { useLocalItem } from "@/lib/useLocal";

/** Percent of a roadmap done, from this device's copy of the progress (null if nothing ticked yet). `units` are hashed keys. */
export function useLocalProgress(localKey: string, units: string[][]): number | null {
  const raw = useLocalItem(localKey);
  return useMemo(() => {
    try {
      const d = raw ? (JSON.parse(raw) as { done?: string[] }) : null;
      if (!d?.done?.length) return null;
      const done = new Set(d.done.map(keyHash));
      return Math.floor((units.filter((u) => u.some((k) => done.has(k))).length / units.length) * 100);
    } catch {
      return null;
    }
  }, [raw, units]);
}

/** Progress bar on a roadmap card. */
export function CardProgress({ localKey, units }: { localKey: string; units: string[][] }) {
  const pct = useLocalProgress(localKey, units);
  if (pct === null) return null;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-[.85rem]"><span className="text-muted">Your progress</span><span className="font-mono">{pct}%</span></div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-sunk"><i className="block h-full rounded-full bg-done" style={{ width: pct + "%" }} /></span>
    </div>
  );
}
