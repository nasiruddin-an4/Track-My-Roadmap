import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { RESOURCE_COLUMNS, groupByTopic, type ResourceMap, type TopicResource } from "@/lib/resources";
import { supabaseConfigured } from "./client";
import { createServerSupabase, getUserId } from "./server";

export type AdminCheck =
  | { ok: true }
  | { ok: false; reason: "no-supabase" | "signed-out" | "not-admin" | "not-set-up" };

/** Is the visitor an admin? Read from the admins table, which only shows a person their own row.
 *  Cached per request, so the admin layout and page share one lookup. */
export const checkAdmin = cache(async (): Promise<AdminCheck> => {
  await connection();
  if (!supabaseConfigured) return { ok: false, reason: "no-supabase" };
  const supabase = await createServerSupabase();
  const uid = await getUserId(supabase);
  if (!uid) return { ok: false, reason: "signed-out" };
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  if (error) {
    console.error("admins:", error.message);
    // the table doesn't exist yet: supabase/schema.sql hasn't been run
    if (error.code === "PGRST205" || error.code === "42P01") return { ok: false, reason: "not-set-up" };
    return { ok: false, reason: "not-admin" };
  }
  if (!data) return { ok: false, reason: "not-admin" };
  return { ok: true };
});

/** Every resource for one roadmap, as rows. Empty when the table isn't set up yet, so pages still load. */
export async function listTopicResources(slug: string): Promise<TopicResource[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createServerSupabase();
  const PAGE = 1000, rows: TopicResource[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("topic_resources").select(RESOURCE_COLUMNS).eq("roadmap", slug).order("id").range(from, from + PAGE - 1);
    if (error) {
      console.error("topic_resources:", error.message);
      return [];
    }
    rows.push(...((data ?? []) as TopicResource[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function getTopicResources(slug: string): Promise<ResourceMap> {
  return groupByTopic(await listTopicResources(slug));
}

/** Per roadmap: how many resources it has, and which keys they're attached to. */
export async function resourceCounts(): Promise<Record<string, { resources: number; keys: string[] }>> {
  if (!supabaseConfigured) return {};
  const supabase = await createServerSupabase();
  // the Data API returns at most 1,000 rows per request, so read in pages
  const PAGE = 1000, rows: { roadmap: string; topic_key: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("topic_resources").select("roadmap, topic_key").order("id").range(from, from + PAGE - 1);
    if (error) {
      console.error("topic_resources:", error.message);
      return {};
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const out: Record<string, { resources: number; keys: Set<string> }> = {};
  for (const r of rows) {
    const e = (out[r.roadmap] ??= { resources: 0, keys: new Set() });
    e.resources++;
    e.keys.add(r.topic_key);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { resources: v.resources, keys: [...v.keys] }]));
}
