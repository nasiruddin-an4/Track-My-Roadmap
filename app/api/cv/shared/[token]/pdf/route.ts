import { cvFileName } from "@/lib/cv/format";
import { renderCvPdf } from "@/lib/cv/pdf";
import { getSharedCv } from "@/lib/cv/repo";
import { readCvData } from "@/lib/cv/schema";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** GET /api/cv/shared/:token/pdf   the PDF of a CV its owner has shared. 404 once the link is turned off. */
export const maxDuration = 30;

export async function GET(_req: Request, ctx: RouteContext<"/api/cv/shared/[token]/pdf">) {
  const { token } = await ctx.params;
  if (!supabaseConfigured) return new Response("Not found", { status: 404 });
  try {
    const cv = await getSharedCv(await createServerSupabase(), token);
    if (!cv) return new Response("This link has been turned off, or it doesn’t exist.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const data = readCvData(cv.data);
    const pdf = await renderCvPdf(data, cv.pageSize, `${data.basics.name || "CV"}`);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${cvFileName(data.basics.name)}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("cv shared pdf:", (e as Error).message);
    return new Response("Something went wrong. Please try again.", { status: 500 });
  }
}
