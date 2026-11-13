import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { roadmapSummaries } from "@/lib/adminData";
import { checkAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | Track My Roadmap" },
  robots: { index: false, follow: false },
};

/** Admins get the dashboard frame (sidebar + top bar); anyone else just sees the page, which shows the sign-in or 404. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-[60svh] place-items-center text-muted" aria-busy="true">Loading…</div>}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const check = await checkAdmin();
  if (!check.ok) return children;
  return <AdminShell roadmaps={await roadmapSummaries()}>{children}</AdminShell>;
}
