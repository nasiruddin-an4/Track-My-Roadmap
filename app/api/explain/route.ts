import { takeQuota } from "@/lib/assistant/limit";
import { BusyError, describeError } from "@/lib/assistant/providers";
import { getRoadmap } from "@/content/roadmaps";
import { explainConfigured, savedExplanation, writeExplanation } from "@/lib/explain";
import { topicInfo } from "@/lib/roadmap";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase, getUserId } from "@/lib/supabase/server";

/**
 * GET /api/explain?roadmap=<slug>&key=<topic key>  → { text }
 * A short explanation of one roadmap topic, for the "What is this?" button in the tracker. Signed-in learners
 * only, like the tracker itself. Saved explanations are free; writing a new one counts against a daily limit
 * (EXPLAIN_DAILY_LIMIT, default 40 per learner), since it costs an AI call.
 */
export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": status === 200 ? "private, max-age=86400" : "no-store" } });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("roadmap") ?? "";
  const key = url.searchParams.get("key") ?? "";
  const uid = supabaseConfigured ? await getUserId(await createServerSupabase()) : null;
  if (!uid) return json({ error: "Please sign in to see explanations." }, 401);

  const rm = getRoadmap(slug);
  const info = rm && key.length <= 300 ? topicInfo(rm, key) : null;
  if (!rm || !info) return json({ error: "That topic isn’t on this roadmap." }, 404);

  const saved = await savedExplanation(slug, key);
  if (saved) return json({ text: saved });
  if (!explainConfigured()) return json({ error: "Explanations aren’t switched on yet." }, 503);

  // a short burst limit, then the daily allowance of new explanations
  const minute = new Date().toISOString().slice(0, 16).replace(/\D/g, "");
  const burst = await takeQuota(`explain-m:u:${uid}:${minute}`, 12);
  if (!burst.ok) return json({ error: "That’s a lot in one go. Please wait a minute and try again." }, 429);
  const day = await takeQuota(`explain:u:${uid}`, Math.max(1, Number(process.env.EXPLAIN_DAILY_LIMIT) || 40));
  if (!day.ok) return json({ error: "You’ve reached today’s limit for new explanations. Topics others have asked about still open." }, 429);

  try {
    const text = await writeExplanation(slug, key, { roadmap: rm.def.title, phase: info.phase, card: info.card, topic: info.topic });
    return json({ text });
  } catch (e) {
    if (e instanceof BusyError) return json({ error: "Our AI is busy right now. Please try again in a minute." }, 503);
    console.error("explain:", describeError(e));
    return json({ error: "We couldn’t explain this topic just now. Please try again." }, 502);
  }
}
