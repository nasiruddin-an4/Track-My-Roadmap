import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** JSON reply that's never cached (CVs are personal). */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
}

export const fail = (status: number, error: string) => json({ error }, status);

export type Viewer = { sb: SupabaseClient; uid: string; name: string; email: string };

/**
 * The signed-in person, or a reply to send instead (401 signed out, 503 when accounts aren't set up).
 * Name and email come from the verified sign-in token, for pre-filling a new CV.
 */
export async function requireViewer(): Promise<Viewer | Response> {
  if (!supabaseConfigured) return fail(503, "The CV Builder needs accounts, which aren’t set up on this server.");
  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.getClaims();
  const c = data?.claims as { sub?: string; email?: string; user_metadata?: Record<string, unknown> } | undefined;
  if (error || !c?.sub) return fail(401, "Please sign in to use the CV Builder.");
  const m = c.user_metadata ?? {};
  return { sb, uid: c.sub, email: String(c.email ?? ""), name: String(m.full_name || m.name || "") };
}

/** Request body as JSON, or null if it isn't JSON. Bodies over `max` bytes are refused. */
export async function readJson(req: Request, max = 300_000): Promise<unknown | null> {
  if (Number(req.headers.get("content-length")) > max) return null;
  try {
    const text = await req.text();
    if (text.length > max) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * A database error as a reply. Missing CV tables (supabase/cv.sql not run yet) get a clear message instead of
 * "try again", and the fix is logged for whoever runs the server.
 */
export function dbFail(e: unknown, what: string, fallback: string): Response {
  const code = (e as { code?: string })?.code;
  if (code === "PGRST205" || code === "42P01" || code === "PGRST202") {
    console.error(`${what}: the CV tables are missing. Run supabase/cv.sql in the Supabase SQL Editor.`);
    return fail(503, "The CV Builder isn’t set up on this server yet. Please try again later.");
  }
  console.error(`${what}:`, (e as Error)?.message);
  return fail(500, fallback);
}
