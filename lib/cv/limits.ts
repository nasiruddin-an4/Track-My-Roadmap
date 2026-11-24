import "server-only";
import { takeQuota } from "@/lib/assistant/limit";

/*
 * How much AI each person can use, counted in the same assistant_usage table as the AI Tutor (lib/assistant/limit.ts).
 * Two limits each: a short burst limit per minute (so a script can't hammer the AI) and a daily allowance.
 *   CV_PARSE_DAILY_LIMIT  CV imports per day (default 10)
 *   CV_AI_DAILY_LIMIT     ATS checks + rewrites per day (default 30)
 */
const KINDS = {
  parse: { perMinute: 3, perDay: () => Number(process.env.CV_PARSE_DAILY_LIMIT) || 10, what: "CV imports" },
  ai: { perMinute: 8, perDay: () => Number(process.env.CV_AI_DAILY_LIMIT) || 30, what: "AI checks and rewrites" },
} as const;

export type CvQuota = { ok: true; remaining: number; limit: number } | { ok: false; error: string };

export async function takeCvQuota(uid: string, kind: keyof typeof KINDS): Promise<CvQuota> {
  const k = KINDS[kind];
  const minute = new Date().toISOString().slice(0, 16).replace(/\D/g, ""); // YYYYMMDDHHmm
  const burst = await takeQuota(`cv-${kind}-m:u:${uid}:${minute}`, k.perMinute);
  if (!burst.ok) return { ok: false, error: "That’s a lot in one go. Please wait a minute and try again." };
  const day = await takeQuota(`cv-${kind}:u:${uid}`, Math.max(1, k.perDay()));
  if (!day.ok) return { ok: false, error: `You’ve used today’s ${day.limit} ${k.what}. They reset tomorrow.` };
  return { ok: true, remaining: day.remaining, limit: day.limit };
}
