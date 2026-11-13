import "server-only";
import { cache } from "react";
import { ROADMAPS } from "@/content/roadmaps";
import { allVideoKeys } from "@/lib/roadmap";
import { resourceCounts } from "@/lib/supabase/admin";

export type RoadmapSummary = {
  slug: string;
  title: string;
  category: string;
  /** places a video can go (main headings, plus standalone topics) */
  total: number;
  /** of those, how many have at least one video */
  topics: number;
  /** videos, playlists and channels */
  resources: number;
};

/** Every roadmap with its video coverage, for the admin sidebar and dashboard (one query per request). */
export const roadmapSummaries = cache(async (): Promise<RoadmapSummary[]> => {
  const counts = await resourceCounts();
  return ROADMAPS.map((rm) => {
    const keys = allVideoKeys(rm);
    const has = new Set(counts[rm.def.slug]?.keys ?? []);
    return {
      slug: rm.def.slug,
      title: rm.def.title,
      category: rm.def.category,
      total: keys.length,
      topics: keys.filter((k) => has.has(k)).length, // videos on renamed/removed topics don't count
      resources: counts[rm.def.slug]?.resources ?? 0,
    };
  });
});
