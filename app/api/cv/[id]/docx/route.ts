import { dbFail, fail, requireViewer } from "@/lib/cv/api";
import { renderCvDocx } from "@/lib/cv/docx";
import { cvFileName } from "@/lib/cv/format";
import { getCv } from "@/lib/cv/repo";
import { readCvData } from "@/lib/cv/schema";

/** GET /api/cv/:id/docx   the saved CV as a Word file, "Jane-Doe-CV.docx" (same layout rules as the PDF). */
export const maxDuration = 30;

export async function GET(_req: Request, ctx: RouteContext<"/api/cv/[id]/docx">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    const cv = await getCv(v.sb, v.uid, id);
    if (!cv) return fail(404, "This CV doesn’t exist, or it isn’t yours.");
    const data = readCvData(cv.data);
    const file = await renderCvDocx(data, cv.pageSize, cv.title);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${cvFileName(data.basics.name, "docx")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return dbFail(e, "cv docx", "Couldn’t make the Word file. Please try again.");
  }
}
