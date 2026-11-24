import { z } from "zod";
import { aiErrorReply, cvAiConfigured } from "@/lib/cv/ai";
import { dbFail, fail, json, readJson, requireViewer } from "@/lib/cv/api";
import { readJobKeywords } from "@/lib/cv/assist";
import { scoreCv } from "@/lib/cv/ats";
import { takeCvQuota } from "@/lib/cv/limits";
import { getCv, listChecks, saveCheck } from "@/lib/cv/repo";
import { readCvData } from "@/lib/cv/schema";

/**
 * GET  /api/cv/:id/check                          → { checks }   the newest checks of this CV
 * POST /api/cv/:id/check  { jobDescription, jobTitle? } → { check, remaining }
 *   Reads the job's keywords (AI), scores the saved CV against them (lib/cv/ats.ts) and keeps the result.
 */
export const maxDuration = 60;

const NOT_FOUND = "This CV doesn’t exist, or it isn’t yours.";
const body = z.object({
  jobDescription: z.string().trim().min(50, "Paste the whole job description (at least a few lines).").max(15000, "That job description is too long. Paste just the job ad."),
  jobTitle: z.string().trim().max(120).optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/cv/[id]/check">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    if (!(await getCv(v.sb, v.uid, id))) return fail(404, NOT_FOUND);
    return json({ checks: await listChecks(v.sb, v.uid, id) });
  } catch (e) {
    return dbFail(e, "cv checks", "Couldn’t load your past checks.");
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/cv/[id]/check">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  if (!cvAiConfigured()) return fail(503, "The ATS check isn’t switched on yet.");
  const { id } = await ctx.params;
  const parsed = body.safeParse(await readJson(req, 64_000));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Bad request.");

  const cv = await getCv(v.sb, v.uid, id).catch(() => null);
  if (!cv) return fail(404, NOT_FOUND);

  const quota = await takeCvQuota(v.uid, "ai");
  if (!quota.ok) return fail(429, quota.error);

  let job;
  try {
    job = await readJobKeywords(parsed.data.jobDescription);
  } catch (e) {
    const r = aiErrorReply(e, "read that job description");
    console.error("cv check:", (e as Error).message);
    return fail(r.status, r.error);
  }

  const result = scoreCv(readCvData(cv.data), job.keywords);
  try {
    const check = await saveCheck(v.sb, v.uid, id, {
      jobTitle: parsed.data.jobTitle || job.jobTitle,
      jobDescription: parsed.data.jobDescription,
      score: result.score,
      keywords: job.keywords,
      missingKeywords: result.missing,
      suggestions: result.suggestions,
    });
    return json({ check, remaining: quota.remaining });
  } catch (e) {
    return dbFail(e, "cv check save", "We checked your CV but couldn’t save the result. Please try again.");
  }
}
