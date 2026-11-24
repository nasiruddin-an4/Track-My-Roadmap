import { dbFail, fail, json, readJson, requireViewer } from "@/lib/cv/api";
import { setPrimary } from "@/lib/cv/repo";

/** POST /api/cv/:id/primary  { primary: boolean } → { ok }   the CV shown on your profile (only one at a time). */
export async function POST(req: Request, ctx: RouteContext<"/api/cv/[id]/primary">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  const body = (await readJson(req, 1000)) as { primary?: unknown } | null;
  if (typeof body?.primary !== "boolean") return fail(400, "Bad request.");
  try {
    if (!(await setPrimary(v.sb, v.uid, id, body.primary))) return fail(404, "This CV doesn’t exist, or it isn’t yours.");
    return json({ ok: true });
  } catch (e) {
    return dbFail(e, "cv primary", "Couldn’t change your primary CV. Please try again.");
  }
}
