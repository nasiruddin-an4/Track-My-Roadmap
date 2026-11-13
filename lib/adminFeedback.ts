import "server-only";
import { allUsers } from "@/lib/adminInsights";
import { profileOf } from "@/lib/profile";
import { checkAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

export type FeedbackKind = "idea" | "bug" | "content" | "other";
export type FeedbackStatus = "new" | "read" | "done";
export type FeedbackItem = {
  id: string; kind: FeedbackKind; rating: number | null; message: string; page: string | null;
  status: FeedbackStatus; createdAt: number;
  user: { id: string; name: string; email: string; avatar: string | null } | null;
};

export type FeedbackResult = { ok: true; items: FeedbackItem[]; named: boolean; now: number } | { ok: false; reason: "not-admin" | "not-set-up" | "error"; message?: string };

/** The latest feedback (up to 1,000), newest first, with each sender's name. Admins only. */
export async function listFeedback(): Promise<FeedbackResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, reason: "not-admin" };
  // read with the admin's own session: row level security only lets admins read feedback
  const sb = await createServerSupabase();
  const { data, error } = await sb.from("feedback")
    .select("id, user_id, kind, rating, message, page, status, created_at")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return { ok: false, reason: "not-set-up" };
    return { ok: false, reason: "error", message: error.message };
  }

  // names and emails need the secret key (auth users); without it, feedback still shows
  const service = getServiceSupabase();
  const people = new Map<string, FeedbackItem["user"]>();
  if (service) {
    try {
      for (const u of await allUsers(service)) {
        const p = profileOf(u);
        people.set(u.id, { id: u.id, name: p.name, email: p.email, avatar: p.avatar ?? null });
      }
    } catch (e) {
      console.error("feedback users:", e);
    }
  }

  const items: FeedbackItem[] = (data ?? []).map((r) => ({
    id: r.id, kind: r.kind, rating: r.rating, message: r.message, page: r.page, status: r.status,
    createdAt: Date.parse(r.created_at) || 0,
    user: people.get(r.user_id) ?? (r.user_id ? { id: r.user_id, name: "Unknown user", email: "", avatar: null } : null),
  }));
  return { ok: true, items, named: people.size > 0, now: Date.now() };
}

/** How many messages are still new, for the sidebar badge. 0 if the table isn't set up yet. */
export async function newFeedbackCount(): Promise<number> {
  const sb = await createServerSupabase();
  const { count, error } = await sb.from("feedback").select("id", { count: "exact", head: true }).eq("status", "new");
  return error ? 0 : count ?? 0;
}
