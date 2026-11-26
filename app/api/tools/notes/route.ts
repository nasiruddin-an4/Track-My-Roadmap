import { z } from "zod";
import { fail, json, readJson, requireViewer } from "@/lib/cv/api";
import {
  notesAiConfigured, notesErrorReply, quizFromNotes, readNotes, summarizeNotes, takeNotesQuota,
} from "@/lib/tools/notesAi";

/**
 * POST /api/tools/notes   (signed-in learners only: every call costs AI time, so each has a daily limit)
 *   { action: "read", images: [base64 JPEG, …up to 3] }  → { found, text, remaining }
 *   { action: "summary", text }                           → { summary, remaining }
 *   { action: "quiz", text }                              → { quiz, remaining }
 * Photos are read and dropped; nothing is stored. The page shrinks photos to about 1600 px before sending.
 */
export const maxDuration = 90;

const MAX_IMAGE = 1_600_000; // characters of base64, about 1.2 MB of JPEG
const jpeg = z.string().max(MAX_IMAGE, "One of the photos is too large.").refine((s) => s.startsWith("/9j/"), "Photos must be sent as JPEG.");
const notes = z.string().trim().min(40, "There isn’t enough text yet. Read some notes first, or type a few lines.").max(30_000, "That’s too much text at once. Try one chapter at a time.");

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), images: z.array(jpeg).min(1, "Add a photo of your notes.").max(3, "Up to 3 pages at a time.") }),
  z.object({ action: z.literal("summary"), text: notes }),
  z.object({ action: z.literal("quiz"), text: notes }),
]);

export async function POST(req: Request) {
  if (!notesAiConfigured()) return fail(503, "The note reader isn’t switched on yet.");
  const v = await requireViewer();
  if (v instanceof Response) return fail(v.status, v.status === 401 ? "Please sign in to use the note reader." : "Sign-in isn’t set up on this server.");
  const parsed = body.safeParse(await readJson(req, 3 * MAX_IMAGE + 2_000));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Those photos are too large. Try fewer pages.");
  const p = parsed.data;

  const quota = await takeNotesQuota(v.uid, p.action === "read" ? "read" : "study");
  if (!quota.ok) return fail(429, quota.error);

  try {
    if (p.action === "read") {
      const r = await readNotes(p.images);
      return json({ ...r, remaining: quota.remaining });
    }
    if (p.action === "summary") return json({ summary: await summarizeNotes(p.text), remaining: quota.remaining });
    return json({ quiz: await quizFromNotes(p.text), remaining: quota.remaining });
  } catch (e) {
    const what = p.action === "read" ? "read the notes" : p.action === "summary" ? "make a summary" : "make a quiz";
    console.error("notes ai:", (e as Error).message);
    const r = notesErrorReply(e, what);
    return fail(r.status, r.error);
  }
}
