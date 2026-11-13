import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "./client";

export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component: cookies are read-only there, which is fine
        }
      },
    },
  });
}

/** The signed-in user's id, or null. Verified locally against the project's public signing key (getClaims),
 *  so page loads don't each call the Auth server, which rate-limits per IP and would see every visitor
 *  as Vercel's IP. */
export async function getUserId(supabase: SupabaseServer): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabase>>;

/** Is the visitor signed in? Checked on the server so private pages never send their content to signed-out visitors.
 *  Without Supabase configured (local development) everything is open. */
export async function isSignedIn(): Promise<boolean> {
  return (await getViewer()).signedIn;
}

/** Whether the current visitor is signed in, checked on the server. */
export async function getViewer(): Promise<{ signedIn: boolean }> {
  await connection();
  if (!supabaseConfigured) return { signedIn: true };
  return { signedIn: Boolean(await getUserId(await createServerSupabase())) };
}
