import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Original CV files in the private "cv-uploads" bucket (supabase/cv.sql), always through the signed-in person's
 * own session, so storage rules keep each person inside their own folder:
 *   <user id>/pending/<upload id>.<ext>   read but not yet saved as a CV (cleared after a day)
 *   <user id>/<cv id>/original.<ext>      attached to a CV; removed when the CV is deleted
 * Storage problems never block the CV itself: the file is a nice-to-have.
 */
const BUCKET = "cv-uploads";
const DAY = 24 * 60 * 60 * 1000;

/** "<uuid>.pdf" or "<uuid>.docx": the only form an upload name can take. */
export const isUploadName = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx)$/.test(s);

/** Keep a just-read file in the person's pending folder. Returns its upload name, or null if it couldn't be stored. */
export async function stashUpload(sb: SupabaseClient, uid: string, ext: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
  const name = `${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(`${uid}/pending/${name}`, bytes, { contentType, upsert: false });
  if (error) { console.error("cv stash:", error.message); return null; }
  void clearOldPending(sb, uid);
  return name;
}

/** Imports that were read but never saved: removed after a day. */
async function clearOldPending(sb: SupabaseClient, uid: string) {
  const { data } = await sb.storage.from(BUCKET).list(`${uid}/pending`, { limit: 100 });
  const old = (data ?? []).filter((f) => f.created_at && Date.now() - new Date(f.created_at).getTime() > DAY).map((f) => `${uid}/pending/${f.name}`);
  if (old.length) await sb.storage.from(BUCKET).remove(old);
}

/** Move a pending upload into the CV's folder. Returns the new path, or null if it couldn't be moved. */
export async function attachUpload(sb: SupabaseClient, uid: string, cvId: string, upload: string): Promise<string | null> {
  const ext = upload.split(".").pop();
  const to = `${uid}/${cvId}/original.${ext}`;
  const { error } = await sb.storage.from(BUCKET).move(`${uid}/pending/${upload}`, to);
  if (error) { console.error("cv attach:", error.message); return null; }
  return to;
}

/** Remove a CV's stored files. Only paths inside the person's own folder are touched. */
export async function removeCvFiles(sb: SupabaseClient, uid: string, cvId: string, sourcePath: string | null) {
  const paths = new Set<string>();
  if (sourcePath?.startsWith(`${uid}/`)) paths.add(sourcePath);
  const { data } = await sb.storage.from(BUCKET).list(`${uid}/${cvId}`, { limit: 100 });
  for (const f of data ?? []) paths.add(`${uid}/${cvId}/${f.name}`);
  if (!paths.size) return;
  const { error } = await sb.storage.from(BUCKET).remove([...paths]);
  if (error) console.error("cv files remove:", error.message);
}
