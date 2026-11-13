"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

/** Whether this user is in the admins table (they can only see their own row). Only used to show the Admin link;
 *  the admin pages and the database check again on their own. */
export function useIsAdmin(userId: string | undefined) {
  const [found, setFound] = useState<{ uid: string; admin: boolean } | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !userId) return;
    let live = true;
    sb.from("admins").select("user_id").eq("user_id", userId).maybeSingle()
      .then(({ data, error }) => { if (live) setFound({ uid: userId, admin: !error && !!data }); });
    return () => { live = false; };
  }, [userId]);
  return !!userId && found?.uid === userId && found.admin;
}
