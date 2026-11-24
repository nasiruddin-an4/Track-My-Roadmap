import { z } from "zod";
import { aiErrorReply, cvAiConfigured } from "@/lib/cv/ai";
import { fail, json, readJson, requireViewer } from "@/lib/cv/api";
import { rewriteBullet, writeSummary } from "@/lib/cv/assist";
import { dateRange } from "@/lib/cv/format";
import { takeCvQuota } from "@/lib/cv/limits";
import { getCv } from "@/lib/cv/repo";
import { readCvData, type CvData } from "@/lib/cv/schema";
import { CATALOG } from "@/lib/catalog";
import { loadAllProgress } from "@/lib/progressRow";
import { roadmapStat } from "@/lib/progressStats";

/**
 * POST /api/cv/rewrite → { suggestion, remaining }
 *   { kind: "bullet", cvId, text, position?, company? }   a stronger version of one bullet
 *   { kind: "summary", cvId }                              a summary from the saved CV and the person's roadmaps
 * Only a suggestion: the editor shows it next to the original and the person decides.
 */
export const maxDuration = 60;

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bullet"), cvId: z.string(), text: z.string().trim().min(3, "Write the point first.").max(400),
    position: z.string().max(120).optional(), company: z.string().max(120).optional() }),
  z.object({ kind: z.literal("summary"), cvId: z.string() }),
]);

/** Everything a summary may draw on, as plain lines. Only facts from the CV and the person's own progress. */
function summaryFacts(d: CvData, roadmaps: string[]): string {
  const b = d.basics;
  return [
    b.label && `Headline: ${b.label}`,
    b.summary && `Current summary: ${b.summary}`,
    d.skills.length && `Skills: ${d.skills.flatMap((s) => s.keywords).filter(Boolean).join(", ")}`,
    ...d.work.filter((w) => w.position || w.name).map((w) => `Experience: ${[w.position, w.name].filter(Boolean).join(" at ")} (${dateRange(w.startDate, w.endDate, true)})${w.highlights.length ? `: ${w.highlights.filter(Boolean).join("; ")}` : ""}`),
    ...d.projects.filter((p) => p.name).map((p) => `Project: ${p.name}${p.description ? `: ${p.description}` : ""}`),
    ...d.education.filter((e) => e.institution).map((e) => `Education: ${[e.studyType, e.area].filter(Boolean).join(", ")} at ${e.institution}${e.endDate ? ` (${e.endDate.slice(0, 4)})` : ""}`),
    ...d.certificates.filter((c) => c.name).map((c) => `Certificate: ${c.name}`),
    roadmaps.length && `Learning roadmaps on Track My Roadmap: ${roadmaps.join("; ")}`,
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  if (!cvAiConfigured()) return fail(503, "AI help isn’t switched on yet.");
  const parsed = body.safeParse(await readJson(req, 8_000));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Bad request.");
  const p = parsed.data;

  const cv = await getCv(v.sb, v.uid, p.cvId).catch(() => null);
  if (!cv) return fail(404, "This CV doesn’t exist, or it isn’t yours.");

  let facts = "";
  if (p.kind === "summary") {
    const rows = await loadAllProgress(v.sb, v.uid).catch(() => ({} as Awaited<ReturnType<typeof loadAllProgress>>));
    const roadmaps = CATALOG.flatMap((c) => {
      const r = rows[c.slug];
      if (!r?.done.length) return [];
      const s = roadmapStat(c, r.done, r.updatedAt);
      return [`${c.title} (${s.pct >= 100 ? "completed" : `${s.pct}% done${s.current ? `, now on ${s.current.title}` : ""}`})`];
    }).slice(0, 5);
    facts = summaryFacts(readCvData(cv.data), roadmaps);
    if (facts.split("\n").length < 2) return fail(422, "Add your skills or experience first, so there’s something to write the summary from.");
  }

  const quota = await takeCvQuota(v.uid, "ai");
  if (!quota.ok) return fail(429, quota.error);

  try {
    const suggestion = p.kind === "bullet"
      ? await rewriteBullet(p.text, { position: p.position, company: p.company })
      : await writeSummary(facts);
    return json({ suggestion, remaining: quota.remaining });
  } catch (e) {
    const r = aiErrorReply(e, p.kind === "bullet" ? "improve that point" : "write a summary");
    console.error("cv rewrite:", (e as Error).message);
    return fail(r.status, r.error);
  }
}
