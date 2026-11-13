/* The roadmap catalogue in the compact form the progress summaries need (server side only). */
import { ROADMAPS } from "@/content/roadmaps";
import type { CatalogEntry } from "@/lib/progressStats";
import { progressUnitsByPhase } from "@/lib/roadmap";

/** Hashed topic keys only, never topic names, so this can be sent to the browser. */
export const CATALOG: CatalogEntry[] = ROADMAPS.map((rm) => {
  const units = progressUnitsByPhase(rm);
  return {
    slug: rm.def.slug,
    title: rm.def.title,
    category: rm.def.category,
    localKey: rm.def.localKey,
    phases: rm.numbered.map((ph, i) => ({ title: ph.title, units: units[i] })),
  };
});
