import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROADMAP_SLUGS } from "@/content/roadmaps/slugs";

/**
 * Runs before matching pages render:
 * 1. Unknown roadmap addresses and broken Road Card links get a real 404 status. (Pages stream, and once
 *    streaming starts the status is already 200, so the check has to happen here.)
 * 2. On signed-in pages, refreshes an expired Supabase sign-in and saves the new cookies before the page
 *    renders (a page render can read cookies but not write them).
 */
const KNOWN = new Set(ROADMAP_SLUGS);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // the video editor moved from /admin/<roadmap> to /admin/videos/<roadmap>
  const old = /^\/admin\/([^/]+)\/?$/.exec(path);
  if (old && KNOWN.has(old[1])) return NextResponse.redirect(new URL(`/admin/videos/${old[1]}`, request.url), 308);

  if (isMissing(path)) {
    // render the site's 404 page with a 404 status: rewrite to an address no route matches
    return NextResponse.rewrite(new URL("/_missing", request.url), { status: 404 });
  }
  if (!needsSession(path)) return NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // nothing to refresh when Supabase isn't set up or the visitor has no session cookie
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // verifies the token locally and refreshes it first if it's about to expire
  await supabase.auth.getClaims();
  return response;
}

/** /roadmaps/<slug>, /roadmaps/<slug>/track and /admin/videos/<slug> for a slug that doesn't exist; /card/<token> that isn't genuine. */
function isMissing(path: string): boolean {
  const rm = /^\/(?:roadmaps\/([^/]+)(?:\/track)?|admin\/videos\/([^/]+))\/?$/.exec(path);
  if (rm) rm[1] = rm[1] ?? rm[2];
  if (rm) {
    try { return !KNOWN.has(decodeURIComponent(rm[1])); } catch { return true; } // broken "%" escape
  }
  const card = /^\/card\/([^/]+)\/?$/.exec(path);
  if (card) return !validCardToken(card[1]);
  return false;
}

/** Same signature check as decodeCard in lib/roadCard.ts, without loading the roadmap catalogue. */
function validCardToken(token: string): boolean {
  const secret = process.env.ROAD_CARD_SECRET;
  if (!secret) return true; // card sharing not set up: let the page explain
  if (token.length > 2000) return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(body).digest("base64url")), got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString());
    return d?.v === 1 && (d.k !== "r" || KNOWN.has(d.rm));
  } catch {
    return false;
  }
}

function needsSession(path: string): boolean {
  return /^\/roadmaps\/[^/]+\/track\/?$/.test(path) || /^\/(habits\/track|account|admin|api\/road-card|api\/youtube-info)(\/|$)/.test(path);
}

export const config = {
  matcher: [
    "/roadmaps/:slug", "/roadmaps/:slug/track", "/admin/:path*", "/card/:token",
    "/habits/track", "/account/:path*", "/api/road-card", "/api/youtube-info",
  ],
};
