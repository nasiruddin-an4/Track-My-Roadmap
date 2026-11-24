import { dbFail, fail, requireViewer } from "@/lib/cv/api";
import { cvFileName } from "@/lib/cv/format";
import { renderCvPdf } from "@/lib/cv/pdf";
import { getCv } from "@/lib/cv/repo";
import { readCvData } from "@/lib/cv/schema";

/**
 * GET /api/cv/:id/pdf            the CV as a PDF download, "Jane-Doe-CV.pdf"
 * GET /api/cv/:id/pdf?inline=1   the same, opened in the browser's PDF viewer
 * Always built from the saved copy, so save before exporting.
 */
export const maxDuration = 30;

export async function GET(req: Request, ctx: RouteContext<"/api/cv/[id]/pdf">) {
  const v = await requireViewer();
  if (v instanceof Response) return v;
  const { id } = await ctx.params;
  try {
    const cv = await getCv(v.sb, v.uid, id);
    if (!cv) return fail(404, "This CV doesn’t exist, or it isn’t yours.");
    const data = readCvData(cv.data);
    const pdf = await renderCvPdf(data, cv.pageSize, cv.title);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${cvFileName(data.basics.name)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return dbFail(e, "cv pdf", "Couldn’t make the PDF. Please try again.");
  }
}
