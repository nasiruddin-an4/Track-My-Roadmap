import "server-only";
import { createHash } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/service";

/** Messages per day (UTC). Guests (not signed in) get a few free tries per IP address, then must sign in;
 *  signed-in learners are counted per account. */
export const DAILY_LIMIT = { guest: 3, member: 30 } as const;

export type Quota = { ok: boolean; remaining: number; limit: number };

/** Guests are keyed by a one-way hash of their IP, so raw addresses are never stored. */
export function guestBucket(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return "ip:" + createHash("sha256").update("tmr-assistant:" + ip).digest("hex").slice(0, 32);
}

// Fallback when Supabase isn't set up (local development) or the table hasn't been created yet.
// Per server instance only, so on Vercel it's a loose limit; run supabase/schema.sql for the real one.
const memory = new Map<string, number>();

const today = () => new Date().toISOString().slice(0, 10);

/** Where a visitor's messages are counted, and their daily limit. */
export function quotaKey(req: Request, uid: string | null): { bucket: string; limit: number } {
  return uid ? { bucket: `u:${uid}`, limit: DAILY_LIMIT.member } : { bucket: guestBucket(req), limit: DAILY_LIMIT.guest };
}

/** How many messages are left today, without counting one. */
export async function peekQuota(bucket: string, limit: number): Promise<Quota> {
  let used: number | null = null;
  const sb = getServiceSupabase();
  if (sb) {
    const { data, error } = await sb.from("assistant_usage").select("count").eq("bucket", bucket).eq("day", today()).maybeSingle();
    if (!error) used = Number((data as { count?: number } | null)?.count ?? 0);
  }
  used ??= memory.get(`${today()}|${bucket}`) ?? 0;
  return { ok: used < limit, remaining: Math.max(0, limit - used), limit };
}

/** Count one message against the bucket's daily limit; ok is false (and nothing is counted) once it's used up. */
export async function takeQuota(bucket: string, limit: number): Promise<Quota> {
  const sb = getServiceSupabase();
  if (sb) {
    const { data, error } = await sb.rpc("assistant_take", { p_bucket: bucket, p_limit: limit });
    if (!error) {
      const used = typeof data === "number" ? data : null;
      return used === null ? { ok: false, remaining: 0, limit } : { ok: true, remaining: Math.max(0, limit - used), limit };
    }
    console.error("assistant_take:", error.message);
  }
  const key = `${today()}|${bucket}`;
  const used = memory.get(key) ?? 0;
  if (used >= limit) return { ok: false, remaining: 0, limit };
  if (memory.size > 5000) memory.clear();
  memory.set(key, used + 1);
  return { ok: true, remaining: limit - used - 1, limit };
}
