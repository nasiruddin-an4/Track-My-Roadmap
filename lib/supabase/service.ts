import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./client";

/**
 * Supabase with the project's secret key: bypasses row level security and can read auth users.
 * Server only (the "server-only" import fails the build if a browser bundle pulls this in), and only ever
 * used after checkAdmin() has passed. Null until SUPABASE_SECRET_KEY is set (Supabase → Project Settings →
 * API Keys → Secret keys); never prefix it with NEXT_PUBLIC_.
 */
const SECRET = process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SECRET) return null;
  client ??= createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
