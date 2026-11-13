import type { User } from "@supabase/supabase-js";

export type Profile = { name: string; firstName: string; email: string; avatar?: string; initials: string; joined?: string; provider?: string };

/** Display details from the sign-in provider's profile (Google gives a name and photo; Apple may give neither). */
export function profileOf(user: User | null): Profile {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const email = user?.email ?? "";
  const name = String(m.full_name || m.name || email.split("@")[0] || "You");
  const parts = name.trim().split(/\s+/);
  const provider = String(user?.app_metadata?.provider ?? "");
  return {
    name,
    firstName: parts[0],
    email,
    avatar: (m.avatar_url || m.picture) as string | undefined,
    initials: ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase(),
    joined: user?.created_at,
    provider: provider ? provider.charAt(0).toUpperCase() + provider.slice(1).replace(/_oidc$/, "") : undefined,
  };
}
