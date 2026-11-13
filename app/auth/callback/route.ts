import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** Google sends people back here after sign-in; swap the code for a session, then return to the page they came from. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";

  if (code && supabaseConfigured) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // admins land on their dashboard; everyone else goes back to where they started
      const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (admin && !next.startsWith("/admin")) next = "/admin";
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, origin));
}
