import { checkAdmin } from "@/lib/supabase/admin";
import { parseYouTube, safeThumb, videoThumb } from "@/lib/youtube";

/**
 * GET /api/youtube-info?url=…&playlist=1
 * Admin-only helper: normalizes a pasted YouTube link and looks up its title, channel and thumbnail
 * through YouTube's public oEmbed endpoint (no API key). Channels have no oEmbed, so their name is typed in.
 */
export async function GET(req: Request) {
  const admin = await checkAdmin();
  if (!admin.ok) return Response.json({ error: "Admins only." }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const parsed = parseYouTube(params.get("url") ?? "", params.get("playlist") === "1");
  if (!parsed) return Response.json({ error: "That doesn’t look like a YouTube video, playlist or channel link." }, { status: 400 });

  const base = { kind: parsed.kind, url: parsed.url, title: "", channel: "", thumbnail: parsed.kind === "video" ? videoThumb(parsed.id) : null };
  if (parsed.kind === "channel") return Response.json(base);

  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.url)}`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) {
      const msg = res.status === 401 || res.status === 403 ? "This one can’t be embedded or is private; fill in the title yourself." : "YouTube couldn’t find it. Check the link, or fill in the title yourself.";
      return Response.json({ ...base, warning: msg });
    }
    const info = (await res.json()) as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
    return Response.json({
      ...base,
      title: typeof info.title === "string" ? info.title.slice(0, 200) : "",
      channel: typeof info.author_name === "string" ? info.author_name.slice(0, 120) : "",
      thumbnail: safeThumb(info.thumbnail_url) ?? base.thumbnail,
    });
  } catch {
    return Response.json({ ...base, warning: "Couldn’t reach YouTube; fill in the title yourself." });
  }
}
