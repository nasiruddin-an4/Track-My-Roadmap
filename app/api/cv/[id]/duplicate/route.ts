import { dbFail, fail, json, requireViewer } from "@/lib/cv/api";
import { duplicateCv, isLimitError } from "@/lib/cv/repo";

/** POST /api/cv/:id/duplicate → { cv }   a copy to tailor for another job (not primary, not shared). */
export async function POST(_req: Request, ctx: RouteContext<"/api/cv/[id]/duplicate">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    const cv = await duplicateCv(v.sb, v.uid, id);
    if (!cv) return fail(404, "This CV doesn’t exist, or it isn’t yours.");
    return json({ cv }, 201);
  } catch (e) {
    if (isLimitError(e)) return fail(409, "You’ve reached the limit of 20 CVs. Delete one to make another.");
    return dbFail(e, "cv duplicate", "Couldn’t copy the CV. Please try again.");
  }
}
