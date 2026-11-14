import type { Metadata } from "next";
import { AiChat } from "@/components/ai/AiChat";
import { ROADMAPS } from "@/content/roadmaps";
import { topicCount } from "@/lib/roadmap";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta(
  "AI Tutor",
  "Tell the AI Tutor what you want to become. It recommends the right free tech career roadmap and tells you where to start.",
  "/ai",
);

/** The AI Tutor, full page. Linked from the navbar and the home page. */
export default function AiPage() {
  return (
    <AiChat roadmaps={ROADMAPS.map((rm) => ({
      slug: rm.def.slug,
      title: rm.def.title,
      tagline: rm.def.tagline,
      category: rm.def.category,
      level: rm.def.level,
      phaseTitles: rm.numbered.map((ph) => ph.title),
      localKey: rm.def.localKey,
      phases: rm.numbered.length,
      topics: topicCount(rm),
    }))} />
  );
}
