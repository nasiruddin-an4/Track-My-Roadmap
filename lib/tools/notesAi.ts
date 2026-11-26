import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { takeQuota } from "@/lib/assistant/limit";

/*
 * The note reader: Claude reads photos of handwritten notes, then turns the text into a revision summary or a quiz.
 * Unlike the other free tools this one needs a server, because reading handwriting takes an AI model; the
 * photos are sent to Claude to be read and are not saved anywhere.
 *   ANTHROPIC_API_KEY        the Claude API key (without it the page says the tool isn't switched on)
 *   NOTES_AI_MODEL           optional; defaults to claude-opus-5-5
 *   NOTES_READ_DAILY_LIMIT   photo readings per learner per day (default 5; each can be up to 3 pages)
 *   NOTES_STUDY_DAILY_LIMIT  summaries plus quizzes per learner per day (default 15)
 * Every answer comes back as JSON in a fixed shape (structured outputs) and is checked with zod.
 */

export const notesAiConfigured = () => !!process.env.ANTHROPIC_API_KEY;
const model = () => process.env.NOTES_AI_MODEL || "claude-opus-5-5";

export const LIMITS = {
  read: { perMinute: 3, perDay: () => Number(process.env.NOTES_READ_DAILY_LIMIT) || 5, what: "note readings" },
  study: { perMinute: 6, perDay: () => Number(process.env.NOTES_STUDY_DAILY_LIMIT) || 15, what: "summaries and quizzes" },
} as const;

export type NotesQuota = { ok: true; remaining: number; limit: number } | { ok: false; error: string };

/** A short burst limit per minute, then the daily allowance, counted in assistant_usage like the AI Tutor. */
export async function takeNotesQuota(uid: string, kind: keyof typeof LIMITS): Promise<NotesQuota> {
  const k = LIMITS[kind];
  const minute = new Date().toISOString().slice(0, 16).replace(/\D/g, "");
  const burst = await takeQuota(`notes-${kind}-m:u:${uid}:${minute}`, k.perMinute);
  if (!burst.ok) return { ok: false, error: "That’s a lot in one go. Please wait a minute and try again." };
  const day = await takeQuota(`notes-${kind}:u:${uid}`, Math.max(1, k.perDay()));
  if (!day.ok) return { ok: false, error: `You’ve used today’s ${day.limit} ${k.what}. They reset tomorrow.` };
  return { ok: true, remaining: day.remaining, limit: day.limit };
}

/** "busy": rate limited. "refused": the model declined. "invalid": no usable answer after a retry. */
export class NotesAiError extends Error {
  constructor(public reason: "busy" | "refused" | "invalid") { super(reason); }
}

let client: Anthropic | null = null;

async function ask<S extends z.ZodType>(
  schema: S, system: string, content: Anthropic.Beta.BetaContentBlockParam[], effort: "low" | "medium",
  accept: (out: z.infer<S>) => boolean = () => true,
): Promise<z.infer<S>> {
  client ??= new Anthropic({ maxRetries: 1, timeout: 90_000 });
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await client.beta.messages.parse({
        model: model(),
        max_tokens: 16000,
        output_config: { effort, format: betaZodOutputFormat(schema) },
        // if the model declines on a false positive, the API retries on its default fallback model in the same call
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new NotesAiError("busy");
      throw e;
    }
    if (res.stop_reason === "refusal") throw new NotesAiError("refused");
    if (res.stop_reason === "max_tokens" || !res.parsed_output) continue;
    const out = res.parsed_output as z.infer<S>;
    if (accept(out)) return out;
  }
  throw new NotesAiError("invalid");
}

const READ_SYSTEM = `You transcribe photos of handwritten notes, letters or pages into text, so the person can use and study them.
- Copy exactly what is written, in the language it is written in (Bengali, English, or both). Never translate.
- Keep the structure: headings, numbered and bulleted lists, line breaks, and the order on the page.
- Write maths and science in plain text, e.g. x^2 + 3x - 4 = 0, H2O, a/b.
- If a word can't be read, write [?] in its place. Don't guess names or numbers.
- Don't correct, explain, add to or summarize the notes.
- Several photos are pages in order: put a line containing only --- between pages.
- If the photos don't show any notes or writing, set found to false and leave text empty.`;

const readSchema = z.object({ found: z.boolean(), text: z.string() });

/** The handwriting in the photos (JPEG, base64), as plain text. */
export async function readNotes(jpegs: string[]): Promise<{ found: boolean; text: string }> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...jpegs.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
    { type: "text", text: jpegs.length > 1 ? `These are ${jpegs.length} pages of notes, in order. Transcribe them.` : "Transcribe these notes." },
  ];
  const out = await ask(readSchema, READ_SYSTEM, content, "medium");
  return { found: out.found && !!out.text.trim(), text: out.text.trim() };
}

const SUMMARY_SYSTEM = `You help someone understand and revise their own notes.
Write a summary of the notes they give you:
- title: what the notes are about, in a few words.
- points: the 4 to 10 most important ideas, one short sentence each, in the order they appear.
- terms: up to 8 key terms or formulas from the notes, each with a one-line meaning taken from the notes.
Write in the same language as the notes. Use only what the notes say; don't add facts from elsewhere. If part of the
notes is marked [?] (unreadable), leave it out.`;

const summarySchema = z.object({
  title: z.string(),
  points: z.array(z.string()),
  terms: z.array(z.object({ term: z.string(), meaning: z.string() })),
});
export type NotesSummary = z.infer<typeof summarySchema>;

export async function summarizeNotes(text: string): Promise<NotesSummary> {
  return ask(summarySchema, SUMMARY_SYSTEM, [{ type: "text", text: `<notes>\n${text}\n</notes>` }], "low", (o) => o.points.length > 0);
}

const QUIZ_SYSTEM = `You write practice quizzes from someone's own notes.
Write 5 multiple-choice questions that check understanding of the notes they give you:
- each question has exactly 4 options and exactly one correct option; answer is its position, 0 to 3.
- vary the position of the correct option, and make the wrong options believable.
- why: one sentence explaining the right answer, based on the notes.
Write in the same language as the notes. Only ask about what the notes actually say. If the notes are too short for
5 good questions, write fewer (at least 1).`;

const quizSchema = z.object({
  questions: z.array(z.object({ question: z.string(), options: z.array(z.string()), answer: z.number().int(), why: z.string() })),
});
export type NotesQuiz = z.infer<typeof quizSchema>;

export async function quizFromNotes(text: string): Promise<NotesQuiz> {
  const out = await ask(quizSchema, QUIZ_SYSTEM, [{ type: "text", text: `<notes>\n${text}\n</notes>` }], "medium",
    (o) => o.questions.length > 0 && o.questions.every((q) => q.options.length === 4 && q.answer >= 0 && q.answer < 4));
  return { questions: out.questions.slice(0, 8) };
}

export function notesErrorReply(e: unknown, what: string): { status: number; error: string } {
  if (e instanceof NotesAiError && e.reason === "busy") return { status: 503, error: "Our AI is busy right now. Please try again in a minute." };
  if (e instanceof NotesAiError && e.reason === "refused") return { status: 422, error: `We couldn’t ${what} for these notes.` };
  return { status: 502, error: `We couldn’t ${what} just now. Please try again.` };
}
