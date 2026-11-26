/*
 * The "What is this?" explanation of a roadmap topic: the question the AI is asked, and the tidy-up of its answer
 * into short plain prose for the topic list. No runtime imports: the unit tests run this file directly.
 */

export const EXPLAIN_SYSTEM = `You explain one topic from a learning roadmap to a student who is about to study it.
Write 2 or 3 short sentences, about 60 words in total, in plain English a beginner can follow:
what the topic is, why it matters on this roadmap, and one concrete example of where it is used.
Plain text only: no headings, lists, markdown, code blocks or links. Don't begin with the topic's name and a colon.
If the topic is phrased as a question, answer it briefly.`;

export type TopicContext = { roadmap: string; phase: string; card: string | null; topic: string };

/** The topic and where it sits, for the AI. Only names from the roadmap files, never anything a visitor typed. */
export function explainPrompt(t: TopicContext): string {
  return [`Roadmap: ${t.roadmap}`, `Phase: ${t.phase}`, t.card && `Section: ${t.card}`, `Topic: ${t.topic}`].filter(Boolean).join("\n");
}

/** The answer as plain sentences: markdown stripped, whitespace collapsed, and cut at a sentence end if it ran long. */
export function cleanExplanation(raw: string, max = 700): string {
  let s = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) {
    const cut = s.slice(0, max);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    s = end > max / 3 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
  }
  return s;
}
