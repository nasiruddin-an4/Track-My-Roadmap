import { safeAvatar } from "@/lib/roadCard";

/**
 * Same-site copy of a Google profile photo, so the Road Card can draw it into a downloadable image even when
 * Google refuses the browser's direct request (rate limits, referrer rules). Only Google photo URLs are fetched.
 */
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 2_000_000;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u") ?? "";
  const url = safeAvatar(raw);
  if (!url) return new Response("Not allowed", { status: 400 });
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), referrerPolicy: "no-referrer" });
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    // photos only: never pass through SVG or HTML, which could run script on this site
    if (!r.ok || !PHOTO_TYPES.has(type)) return new Response("Not found", { status: 404 });
    if (Number(r.headers.get("content-length")) > MAX_BYTES) return new Response("Too large", { status: 413 });
    const body = await r.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response("Too large", { status: 413 });
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 502 });
  }
}
