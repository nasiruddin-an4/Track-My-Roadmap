import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase sign-in fresh on the signed-in pages. If the one-hour access token has expired,
 * it is refreshed here, where the new cookies can be saved, before the page renders. (A page render
 * can read cookies but not write them, so without this the server would refresh again on every load.)
 * Public pages aren't matched, so they stay static and fast.
 */
export async function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/roadmaps/:slug/track", "/habits/track", "/account/:path*", "/admin/:path*", "/api/road-card", "/api/youtube-info"],
};
