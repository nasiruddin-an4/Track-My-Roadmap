import { NextResponse } from "next/server";
import { cardFor, cardSigningConfigured, encodeCard, roadmapCardFor } from "@/lib/roadCard";
import { SITE_URL } from "@/lib/site";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

/** A shareable link to the signed-in person's Road Card: the overall card, or one roadmap's with ?roadmap=<slug>.
 *  ?tz= is their Date.getTimezoneOffset(), for the habit streak. */
export async function GET(request: Request) {
  if (!supabaseConfigured || !cardSigningConfigured())
    return NextResponse.json({ error: "Card sharing isn’t set up on this site." }, { status: 503 });

  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to share your Road Card." }, { status: 401 });

  const q = new URL(request.url).searchParams;
  const tz = Number(q.get("tz"));
  const slug = q.get("roadmap");
  try {
    const card = slug ? await roadmapCardFor(sb, user, slug) : await cardFor(sb, user, Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : 0);
    if (!card) return NextResponse.json({ error: "No such roadmap." }, { status: 404 });
    const token = encodeCard(card);
    return NextResponse.json({ url: `${SITE_URL}/card/${token}` }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn’t load your progress." }, { status: 502 });
  }
}
