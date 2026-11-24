import { randomBytes } from "node:crypto";
import { dbFail, fail, json, requireViewer } from "@/lib/cv/api";
import { setShareToken } from "@/lib/cv/repo";

/**
 * POST   /api/cv/:id/share → { token }   turn the share link on, with a new unguessable link (any old link stops working)
 * DELETE /api/cv/:id/share → { ok }      turn it off: the link stops working at once
 * Links are off until the owner turns them on. Anyone with the link sees the CV at /cv/s/<token>.
 */
const NOT_FOUND = "This CV doesn’t exist, or it isn’t yours.";

export async function POST(_req: Request, ctx: RouteContext<"/api/cv/[id]/share">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  const token = randomBytes(24).toString("base64url"); // 192 bits
  try {
    if (!(await setShareToken(v.sb, v.uid, id, token))) return fail(404, NOT_FOUND);
    return json({ token });
  } catch (e) {
    return dbFail(e, "cv share", "Couldn’t make a share link. Please try again.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/cv/[id]/share">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    if (!(await setShareToken(v.sb, v.uid, id, null))) return fail(404, NOT_FOUND);
    return json({ ok: true });
  } catch (e) {
    return dbFail(e, "cv unshare", "Couldn’t turn the link off. Please try again.");
  }
}
