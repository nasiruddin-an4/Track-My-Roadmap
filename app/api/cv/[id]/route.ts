import { dbFail, fail, json, readJson, requireViewer } from "@/lib/cv/api";
import { deleteCv, getCv, isLimitError, updateCv } from "@/lib/cv/repo";
import { cvPatchSchema, readCvData } from "@/lib/cv/schema";
import { removeCvFiles } from "@/lib/cv/storage";

/**
 * GET    /api/cv/:id                          → { cv }
 * PATCH  /api/cv/:id  { title?, pageSize?, data? } → { cv }   (data is validated in full)
 * DELETE /api/cv/:id                          → { ok: true }   (also removes the uploaded original)
 * A CV that isn't in the signed-in person's account is a 404, the same as one that doesn't exist.
 */
const NOT_FOUND = "This CV doesn’t exist, or it isn’t yours.";

export async function GET(_req: Request, ctx: RouteContext<"/api/cv/[id]">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    const cv = await getCv(v.sb, v.uid, id);
    if (!cv) return fail(404, NOT_FOUND);
    return json({ cv: { ...cv, data: readCvData(cv.data) } });
  } catch (e) {
    return dbFail(e, "cv get", "Couldn’t load the CV. Please try again.");
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/cv/[id]">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  const parsed = cvPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(400, i ? `${i.path.join(".") || "CV"}: ${i.message}` : "Bad request.");
  }
  try {
    const cv = await updateCv(v.sb, v.uid, id, parsed.data);
    if (!cv) return fail(404, NOT_FOUND);
    return json({ cv: { ...cv, data: readCvData(cv.data) } });
  } catch (e) {
    if (isLimitError(e)) return fail(413, "This CV is too long to save. Try shortening some sections.");
    return dbFail(e, "cv update", "Couldn’t save. Please try again.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/cv/[id]">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    const gone = await deleteCv(v.sb, v.uid, id);
    if (!gone) return fail(404, NOT_FOUND);
    await removeCvFiles(v.sb, v.uid, id, gone.sourceFilePath);
    return json({ ok: true });
  } catch (e) {
    return dbFail(e, "cv delete", "Couldn’t delete the CV. Please try again.");
  }
}
