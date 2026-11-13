/*
 * Reading and writing roadmap_progress rows. `completed_at` was added after launch; until supabase/schema.sql has
 * been re-run it doesn't exist, so the first "no such column" error switches these calls to work without it
 * (certificates then fall back to the last-edit date) instead of breaking progress saving.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProgressRow = { done: string[]; updatedAt: number; completedAt: number | null };

let hasCompletedAt = true;

function missingColumn(e: { code?: string; message?: string }) {
  return e.code === "42703" || e.code === "PGRST204" || /completed_at/.test(e.message ?? "");
}

type Raw = { roadmap?: string; done?: string[] | null; updated_at?: number | string | null; completed_at?: number | string | null };
const toRow = (r: Raw): ProgressRow => ({ done: r.done ?? [], updatedAt: Number(r.updated_at) || 0, completedAt: Number(r.completed_at) || null });

/** One roadmap's row for this person, or null if they haven't started it. */
export async function loadProgress(sb: SupabaseClient, uid: string, slug: string): Promise<ProgressRow | null> {
  for (;;) {
    const cols = hasCompletedAt ? "done, updated_at, completed_at" : "done, updated_at";
    const { data, error } = await sb.from("roadmap_progress").select(cols).eq("user_id", uid).eq("roadmap", slug).maybeSingle();
    if (error && hasCompletedAt && missingColumn(error)) { hasCompletedAt = false; continue; }
    if (error) throw error;
    return data ? toRow(data as Raw) : null;
  }
}

/** Every roadmap row for this person, keyed by slug. */
export async function loadAllProgress(sb: SupabaseClient, uid: string): Promise<Record<string, ProgressRow>> {
  for (;;) {
    const cols = hasCompletedAt ? "roadmap, done, updated_at, completed_at" : "roadmap, done, updated_at";
    const { data, error } = await sb.from("roadmap_progress").select(cols).eq("user_id", uid);
    if (error && hasCompletedAt && missingColumn(error)) { hasCompletedAt = false; continue; }
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as Raw[]).map((r) => [r.roadmap as string, toRow(r)]));
  }
}

export async function saveProgress(sb: SupabaseClient, uid: string, slug: string, d: ProgressRow): Promise<void> {
  for (;;) {
    const row = { user_id: uid, roadmap: slug, done: d.done, updated_at: d.updatedAt, ...(hasCompletedAt ? { completed_at: d.completedAt } : {}) };
    const { error } = await sb.from("roadmap_progress").upsert(row);
    if (error && hasCompletedAt && missingColumn(error)) { hasCompletedAt = false; continue; }
    if (error) throw error;
    return;
  }
}
