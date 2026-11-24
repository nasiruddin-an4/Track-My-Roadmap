import { dbFail, fail, json, readJson, requireViewer } from "@/lib/cv/api";
import { createCv, isLimitError, listCvs, setSourceFile } from "@/lib/cv/repo";
import { cvCreateSchema, emptyCv } from "@/lib/cv/schema";
import { attachUpload, isUploadName } from "@/lib/cv/storage";

/**
 * GET  /api/cv   → { cvs: CvSummary[] }   the signed-in person's CVs, newest first
 * POST /api/cv   { title?, pageSize?, data?, upload? } → { cv }   a new CV; without `data`, a blank one with the
 *                person's name and email from their account. `upload` (from /api/cv/parse) attaches the original file.
 */
export async function GET() {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  try {
    return json({ cvs: await listCvs(v.sb, v.uid) });
  } catch (e) {
    return dbFail(e, "cv list", "Couldn’t load your CVs. Please try again.");
  }
}

export async function POST(req: Request) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const body = await readJson(req);
  const parsed = cvCreateSchema.safeParse(body ?? {});
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Bad request.");
  const p = parsed.data;
  try {
    const cv = await createCv(v.sb, v.uid, {
      title: p.title ?? "My CV",
      pageSize: p.pageSize ?? "a4",
      data: p.data ?? emptyCv({ name: v.name, email: v.email }),
    });
    const upload = (body as { upload?: unknown } | null)?.upload;
    if (isUploadName(upload)) {
      const path = await attachUpload(v.sb, v.uid, cv.id, upload);
      if (path) await setSourceFile(v.sb, v.uid, cv.id, path).catch((e) => console.error("cv source:", (e as Error).message));
    }
    return json({ cv }, 201);
  } catch (e) {
    if (isLimitError(e)) return fail(409, "You’ve reached the limit of 20 CVs. Delete one to make another.");
    return dbFail(e, "cv create", "Couldn’t create the CV. Please try again.");
  }
}
