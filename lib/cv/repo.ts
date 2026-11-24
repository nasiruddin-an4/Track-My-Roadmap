/*
 * Reading and writing CVs. Every query is filtered by the signed-in person's id as well as by row level
 * security (supabase/cv.sql), so a CV id from someone else's account finds nothing.
 *
 * Callers validate content with lib/cv/schema.ts first. Type-only imports: the unit tests run this file directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AtsSuggestion, JobKeyword } from "./ats";
import type { CvData, PageSize } from "./schema";

export type CvSummary = { id: string; title: string; isPrimary: boolean; isShared: boolean; pageSize: PageSize; createdAt: string; updatedAt: string; name: string; label: string };
export type CvRecord = Omit<CvSummary, "name" | "label" | "isShared"> & { templateId: string; data: unknown; hasSourceFile: boolean; shareToken: string | null };

type Row = {
  id: string; title: string; template_id?: string; page_size: string; is_primary: boolean;
  created_at: string; updated_at: string; data?: unknown; name?: string | null; label?: string | null; source_file_path?: string | null; share_token?: string | null;
};

const FULL = "id, title, template_id, page_size, is_primary, created_at, updated_at, data, source_file_path, share_token";
// the list only needs the name and headline from inside `data`, not the whole CV
const LIST = "id, title, page_size, is_primary, created_at, updated_at, share_token, name:data->basics->>name, label:data->basics->>label";

const pageSize = (s: string): PageSize => (s === "letter" ? "letter" : "a4");

const toRecord = (r: Row): CvRecord => ({
  id: r.id, title: r.title, templateId: r.template_id ?? "classic", pageSize: pageSize(r.page_size),
  isPrimary: r.is_primary, createdAt: r.created_at, updatedAt: r.updated_at, data: r.data, hasSourceFile: !!r.source_file_path,
  shareToken: r.share_token ?? null,
});

/** True for a well-formed id, so junk never reaches the database (Postgres would reject it with an error). */
export const isCvId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function listCvs(sb: SupabaseClient, uid: string): Promise<CvSummary[]> {
  const { data, error } = await sb.from("cvs").select(LIST).eq("user_id", uid).order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, title: r.title, pageSize: pageSize(r.page_size), isPrimary: r.is_primary, isShared: !!r.share_token,
    createdAt: r.created_at, updatedAt: r.updated_at, name: r.name ?? "", label: r.label ?? "",
  }));
}

export async function getCv(sb: SupabaseClient, uid: string, id: string): Promise<CvRecord | null> {
  if (!isCvId(id)) return null;
  const { data, error } = await sb.from("cvs").select(FULL).eq("id", id).eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as Row) : null;
}

export async function createCv(sb: SupabaseClient, uid: string, input: { title: string; pageSize: PageSize; data: CvData }): Promise<CvRecord> {
  const { data, error } = await sb.from("cvs")
    .insert({ user_id: uid, title: input.title, page_size: input.pageSize, data: input.data })
    .select(FULL).single();
  if (error) throw error;
  return toRecord(data as Row);
}

/** Null when there's no such CV in this person's account. */
export async function updateCv(sb: SupabaseClient, uid: string, id: string, patch: { title?: string; pageSize?: PageSize; data?: CvData }): Promise<CvRecord | null> {
  if (!isCvId(id)) return null;
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.pageSize !== undefined) row.page_size = patch.pageSize;
  if (patch.data !== undefined) row.data = patch.data;
  const { data, error } = await sb.from("cvs").update(row).eq("id", id).eq("user_id", uid).select(FULL).maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as Row) : null;
}

/** A copy of one of this person's CVs: same content and paper size, not primary, not shared, no uploaded file. */
export async function duplicateCv(sb: SupabaseClient, uid: string, id: string): Promise<CvRecord | null> {
  const cv = await getCv(sb, uid, id);
  if (!cv) return null;
  const title = `Copy of ${cv.title}`.slice(0, 80);
  return createCv(sb, uid, { title, pageSize: cv.pageSize, data: cv.data as CvData });
}

/** Make this the person's primary CV (or stop it being primary). Only one CV can be primary. False if not found. */
export async function setPrimary(sb: SupabaseClient, uid: string, id: string, primary: boolean): Promise<boolean> {
  if (!isCvId(id)) return false;
  if (primary) {
    const { error } = await sb.from("cvs").update({ is_primary: false }).eq("user_id", uid).eq("is_primary", true).neq("id", id);
    if (error) throw error;
  }
  const { data, error } = await sb.from("cvs").update({ is_primary: primary }).eq("id", id).eq("user_id", uid).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Turn the share link on (a new token) or off (null). False if not found. */
export async function setShareToken(sb: SupabaseClient, uid: string, id: string, token: string | null): Promise<boolean> {
  if (!isCvId(id)) return false;
  const { data, error } = await sb.from("cvs").update({ share_token: token }).eq("id", id).eq("user_id", uid).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** A shared CV, for anyone with the link. Goes through the shared_cv() database function, which matches the token only. */
export async function getSharedCv(sb: SupabaseClient, token: string): Promise<{ data: unknown; pageSize: PageSize; updatedAt: string } | null> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const { data, error } = await sb.rpc("shared_cv", { p_token: token });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { data: unknown; page_size: string; updated_at: string } | undefined;
  return row ? { data: row.data, pageSize: pageSize(row.page_size), updatedAt: row.updated_at } : null;
}

/** Record where the CV's original file is stored. */
export async function setSourceFile(sb: SupabaseClient, uid: string, id: string, path: string): Promise<void> {
  const { error } = await sb.from("cvs").update({ source_file_path: path }).eq("id", id).eq("user_id", uid);
  if (error) throw error;
}

/** Null when there's no such CV in this person's account; otherwise where its original file was (if any). */
export async function deleteCv(sb: SupabaseClient, uid: string, id: string): Promise<{ sourceFilePath: string | null } | null> {
  if (!isCvId(id)) return null;
  const { data, error } = await sb.from("cvs").delete().eq("id", id).eq("user_id", uid).select("id, source_file_path");
  if (error) throw error;
  const row = (data ?? [])[0] as { source_file_path?: string | null } | undefined;
  return row ? { sourceFilePath: row.source_file_path ?? null } : null;
}

/** "Postgres said no because of a limit": too many CVs, or a CV that's too large. */
export function isLimitError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === "23514";
}

/* ---------- ATS checks ---------- */

export type CvCheckRecord = {
  id: string; createdAt: string; jobTitle: string; jobDescription: string; score: number;
  keywords: JobKeyword[]; missingKeywords: JobKeyword[]; suggestions: AtsSuggestion[];
};

type CheckRow = {
  id: string; created_at: string; job_title: string | null; job_description: string; score: number;
  keywords: JobKeyword[] | null; missing_keywords: JobKeyword[] | null; suggestions: AtsSuggestion[] | null;
};
const CHECK = "id, created_at, job_title, job_description, score, keywords, missing_keywords, suggestions";
const toCheck = (r: CheckRow): CvCheckRecord => ({
  id: r.id, createdAt: r.created_at, jobTitle: r.job_title ?? "", jobDescription: r.job_description, score: r.score,
  keywords: r.keywords ?? [], missingKeywords: r.missing_keywords ?? [], suggestions: r.suggestions ?? [],
});

/** The newest checks of one of this person's CVs. */
export async function listChecks(sb: SupabaseClient, uid: string, cvId: string, limit = 10): Promise<CvCheckRecord[]> {
  if (!isCvId(cvId)) return [];
  const { data, error } = await sb.from("cv_checks").select(CHECK).eq("cv_id", cvId).eq("user_id", uid).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as CheckRow[]).map(toCheck);
}

/** Save a check, keeping only the newest 20 per CV. */
export async function saveCheck(sb: SupabaseClient, uid: string, cvId: string, c: Omit<CvCheckRecord, "id" | "createdAt">): Promise<CvCheckRecord> {
  const { data, error } = await sb.from("cv_checks").insert({
    cv_id: cvId, user_id: uid, job_title: c.jobTitle || null, job_description: c.jobDescription, score: c.score,
    keywords: c.keywords, missing_keywords: c.missingKeywords, suggestions: c.suggestions,
  }).select(CHECK).single();
  if (error) throw error;
  const { data: old } = await sb.from("cv_checks").select("id").eq("cv_id", cvId).eq("user_id", uid).order("created_at", { ascending: false }).range(20, 100);
  if (old?.length) await sb.from("cv_checks").delete().eq("user_id", uid).in("id", old.map((r: { id: string }) => r.id));
  return toCheck(data as CheckRow);
}
