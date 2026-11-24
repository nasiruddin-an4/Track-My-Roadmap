/*
 * CV suggestions from what someone has learned on Track My Roadmap: skills from ticked topics (grouped by roadmap
 * phase), certificates from completed roadmaps, and a headline from their main career roadmap.
 * These are only ever offered; the person picks what goes on their CV.
 *
 * Pure (no imports), so the unit tests run this file directly.
 */

export type TopicSource = {
  slug: string;
  title: string;
  category: string;
  phases: { title: string; topics: { key: string; name: string }[] }[];
};

export type SkillSuggestion = { id: string; roadmap: string; group: string; keywords: string[] };
export type CertificateSuggestion = { id: string; name: string; issuer: string; date: string };
export type Suggestions = { label: string | null; skills: SkillSuggestion[]; certificates: CertificateSuggestion[] };

const MAX_GROUPS = 12, MAX_KEYWORDS = 25;
// roadmap names that are a job title, so "Aspiring <title>" reads as a headline
const ROLE = /\b(developer|engineer|scientist|analyst|builder|architect|manager|designer|administrator|specialist|tester)$/i;

/** A topic's name as a CV skill, or null when it isn't one (a question, a long phrase, a "build a project" task). */
export function skillName(raw: string): string | null {
  const s = raw.replace(/^learn the basics of\s+/i, "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 40 || /[?]$/.test(s)) return null;
  if (/^(what|why|how|when|where|which|who|is|are|should|do|does|can)\b/i.test(s)) return null;
  if (/^(build|make|create|practice|read|watch|learn|understand|apply|deploy your|write a)\b/i.test(s)) return null;
  return s;
}

const yyyymm = (ms: number) => new Date(ms).toISOString().slice(0, 7);

export function buildSuggestions(
  roadmaps: TopicSource[],
  progress: Record<string, { done: string[] }>,
  completed: { slug: string; title: string; when: number }[],
): Suggestions {
  // roadmaps the person has started, most ticks first
  const started = roadmaps
    .map((rm) => ({ rm, done: new Set(progress[rm.slug]?.done ?? []) }))
    .filter((x) => x.done.size > 0)
    .sort((a, b) => b.done.size - a.done.size);

  const skills: SkillSuggestion[] = [];
  const seen = new Set<string>(); // a skill learned in two roadmaps is offered once
  for (const { rm, done } of started) {
    rm.phases.forEach((ph, i) => {
      const words: string[] = [];
      for (const t of ph.topics) {
        if (!done.has(t.key)) continue;
        const name = skillName(t.name);
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        words.push(name);
      }
      if (words.length) skills.push({ id: `${rm.slug}:${i}`, roadmap: rm.title, group: ph.title, keywords: words.slice(0, MAX_KEYWORDS) });
    });
  }

  const finished = new Set(completed.map((c) => c.slug));
  const main = started.find(({ rm }) => rm.category === "Career path" && ROLE.test(rm.title));
  const label = main ? (finished.has(main.rm.slug) ? main.rm.title : `Aspiring ${main.rm.title}`) : null;

  return {
    label,
    skills: skills.slice(0, MAX_GROUPS),
    certificates: completed.map((c) => ({ id: c.slug, name: `${c.title} Roadmap`, issuer: "Track My Roadmap", date: c.when ? yyyymm(c.when) : "" })),
  };
}
