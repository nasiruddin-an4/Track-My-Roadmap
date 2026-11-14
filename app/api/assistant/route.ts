import { DAILY_LIMIT, peekQuota, quotaKey, takeQuota } from "@/lib/assistant/limit";
import { learnerContext, VALID_SLUGS } from "@/lib/assistant/prompt";
import { activeProvider, BusyError, describeError, streamReply, type Turn } from "@/lib/assistant/providers";
import { loadAllProgress } from "@/lib/progressRow";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase, getUserId } from "@/lib/supabase/server";

/**
 * POST /api/assistant  { messages: [{ role, content }...], local?: { [slug]: doneKeys[] } }
 * The AI Tutor. Streams the reply as plain text. Signed-in learners' progress is read from their account;
 * `local` (this browser's progress) is only used when there's no account to read from.
 * Answers 429 once the daily limit is used, 503 when no AI key is set (see lib/assistant/providers.ts).
 * GET /api/assistant  { signedIn, remaining, limit, memberLimit }: today's messages left, without using one.
 */
export const maxDuration = 60;

const MAX_TURNS = 12;          // messages of history sent to the model
const MAX_USER_CHARS = 1200;
const MAX_ASSISTANT_CHARS = 4000;

function parseMessages(raw: unknown): Turn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns = raw
    .filter((m): m is Turn => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS) }))
    .slice(-MAX_TURNS);
  while (turns.length && turns[0].role !== "user") turns.shift();
  // two user messages in a row (the first one failed) are fine: the API reads them as one turn
  return turns.length && turns[turns.length - 1].role === "user" ? turns : null;
}

function parseLocal(raw: unknown): { slug: string; done: string[] }[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([slug, done]) => VALID_SLUGS.has(slug) && Array.isArray(done))
    .slice(0, 60)
    .map(([slug, done]) => ({ slug, done: (done as unknown[]).filter((k): k is string => typeof k === "string" && k.length <= 300).slice(0, 3000) }));
}

async function viewerId(): Promise<string | null> {
  return supabaseConfigured ? getUserId(await createServerSupabase()) : null;
}

export async function GET(req: Request) {
  const uid = await viewerId();
  const { bucket, limit } = quotaKey(req, uid);
  const q = await peekQuota(bucket, limit);
  return Response.json({ signedIn: !!uid, remaining: q.remaining, limit: q.limit, memberLimit: DAILY_LIMIT.member }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const provider = activeProvider();
  if (!provider)
    return Response.json({ error: "The AI Tutor isn’t switched on yet." }, { status: 503 });

  let body: { messages?: unknown; local?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const messages = parseMessages(body.messages);
  if (!messages) return Response.json({ error: "Bad request." }, { status: 400 });

  // who is asking, and what have they done so far
  let uid: string | null = null;
  let progress: { slug: string; done: string[] }[] = [];
  if (supabaseConfigured) {
    const sb = await createServerSupabase();
    uid = await getUserId(sb);
    if (uid) {
      try {
        const rows = await loadAllProgress(sb, uid);
        progress = Object.entries(rows).sort((a, b) => b[1].updatedAt - a[1].updatedAt).map(([slug, r]) => ({ slug, done: r.done }));
      } catch (e) {
        console.error("assistant progress:", e);
      }
    }
  }
  if (!progress.length) progress = parseLocal(body.local);

  const key = quotaKey(req, uid);
  const quota = await takeQuota(key.bucket, key.limit);
  if (!quota.ok) {
    return Response.json({
      error: uid
        ? "You’ve used today’s AI Tutor messages. They reset tomorrow."
        : `You’ve used your ${quota.limit} free messages. Sign in to keep chatting (it’s free).`,
      limit: quota.limit, remaining: 0, signedIn: !!uid,
    }, { status: 429 });
  }

  const learner = learnerContext(!!uid || !supabaseConfigured, progress);
  const abort = new AbortController();
  const enc = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const text of streamReply(provider, learner, messages, abort.signal)) controller.enqueue(enc.encode(text));
      } catch (e) {
        if (!abort.signal.aborted) {
          console.error("assistant stream:", describeError(e));
          controller.enqueue(enc.encode(e instanceof BusyError ? "\n\n[[busy]]" : "\n\n[[error]]"));
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() { abort.abort(); },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Assistant-Remaining": String(quota.remaining),
      "X-Assistant-Limit": String(quota.limit),
      "X-Assistant-Signed-In": uid ? "1" : "0",
    },
  });
}
