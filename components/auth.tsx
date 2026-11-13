"use client";

import type { Provider, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { clearLocalData, OWNER_KEY } from "@/lib/storage";

type Auth = {
  /** true once we know whether someone is signed in */
  ready: boolean;
  user: User | null;
  configured: boolean;
  /** OAuth sign-in (Google by default); afterwards the visitor lands on `next` (default: the current page). */
  signIn: (next?: string, provider?: Provider) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth>({
  ready: false, user: null, configured: false, signIn: async () => {}, signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/** Data on this device belongs to whoever signed in last; switch accounts and it is cleared, so accounts never mix. */
function claimDevice(user: User) {
  let owner: string | null = null;
  try { owner = localStorage.getItem(OWNER_KEY); } catch {}
  if (owner && owner !== user.id) {
    clearLocalData();
    try { localStorage.setItem(OWNER_KEY, user.id); } catch {}
    location.reload();
    return false;
  }
  try { localStorage.setItem(OWNER_KEY, user.id); } catch {}
  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let first = true;
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      if (u && !claimDevice(u)) return;
      setUser((prev) => (prev?.id === u?.id ? prev : u));
      if (first) { first = false; setReady(true); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (to?: string, provider: Provider = "google") => {
    const sb = getSupabase();
    if (!sb) return;
    const next = to ?? location.pathname + location.search;
    await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    clearLocalData();
    location.reload();
  }, []);

  const value = useMemo(() => ({ ready, user, configured: supabaseConfigured, signIn, signOut }), [ready, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
