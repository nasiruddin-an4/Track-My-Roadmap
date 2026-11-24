import { ROADMAPS } from "@/content/roadmaps";
import { dbFail, json, requireViewer } from "@/lib/cv/api";
import { buildSuggestions, type TopicSource } from "@/lib/cv/autofill";
import { CATALOG } from "@/lib/catalog";
import { roadmapStat } from "@/lib/progressStats";
import { loadAllProgress } from "@/lib/progressRow";

/**
 * GET /api/cv/roadmap-data → { label, skills, certificates }
 * CV suggestions from the signed-in person's Track My Roadmap progress. Nothing is added to a CV here.
 */

// topic keys and names per phase, built once (the catalogue is static)
const SOURCES: TopicSource[] = ROADMAPS.map((rm) => ({
  slug: rm.def.slug,
  title: rm.def.title,
  category: rm.def.category,
  phases: rm.phases.filter((ph) => !ph.ongoing).map((ph) => ({
    title: ph.title,
    topics: ph.cards.flatMap((c) => c.rows.map((r) => ({ key: r.key, name: r.name }))),
  })),
}));

export async function GET() {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  try {
    const rows = await loadAllProgress(v.sb, v.uid);
    const completed = CATALOG.flatMap((c) => {
      const r = rows[c.slug];
      if (!r) return [];
      const s = roadmapStat(c, r.done, r.updatedAt);
      return s.total > 0 && s.done === s.total ? [{ slug: c.slug, title: c.title, when: r.completedAt || r.updatedAt }] : [];
    });
    return json(buildSuggestions(SOURCES, rows, completed));
  } catch (e) {
    return dbFail(e, "cv roadmap-data", "Couldn’t load your roadmap progress.");
  }
}
