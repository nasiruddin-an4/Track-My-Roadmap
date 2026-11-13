/*
 * The roadmap catalogue. To add a roadmap: create a JSON file in data/
 * (same shape as software-engineer.json), then run scripts/gen-roadmap-index.mjs.
 */
import { buildRoadmap, type Roadmap } from "@/lib/roadmap";
import { ROADMAP_DEFS } from "./data";

export const FEATURED_ROADMAP_SLUGS = ["software-engineer", "ai-engineer", "frontend"];
export const ROADMAPS = ROADMAP_DEFS
  .map(buildRoadmap)
  .sort((a, b) => {
    const aOrder = FEATURED_ROADMAP_SLUGS.indexOf(a.def.slug);
    const bOrder = FEATURED_ROADMAP_SLUGS.indexOf(b.def.slug);
    if (aOrder !== -1 || bOrder !== -1)
      return (aOrder === -1 ? FEATURED_ROADMAP_SLUGS.length : aOrder) - (bOrder === -1 ? FEATURED_ROADMAP_SLUGS.length : bOrder);
    return a.def.title.localeCompare(b.def.title);
  });

export function getRoadmap(slug: string): Roadmap | undefined {
  return ROADMAPS.find((r) => r.def.slug === slug);
}

/** Planned roadmaps shown on the home page as "Coming soon". */
export const COMING_SOON: { title: string; tagline: string; category: string }[] = [
  { title: "Backend Developer", tagline: "APIs, databases, auth, caching, testing and deployment.", category: "Career path" },
];
