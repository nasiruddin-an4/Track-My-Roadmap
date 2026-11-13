import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { UsersTable } from "@/components/admin/UsersTable";
import { adminInsights } from "@/lib/adminInsights";
import { checkAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Users" };

/** Every account: who they are, when they joined, when they last ticked something, and their progress. */
export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted" aria-busy="true">Loading…</div>}>
      <Users />
    </Suspense>
  );
}

async function Users() {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate check={check} />;
  const res = await adminInsights();
  if (!res.ok) {
    return (
      <div className="grid max-w-[640px] gap-2 rounded-2xl border border-line bg-surface p-6">
        <h1 className="m-0 text-[1.2rem] font-bold">Users aren&rsquo;t available yet</h1>
        <p className="m-0 text-muted">
          {res.reason === "no-secret-key"
            ? "Add SUPABASE_SECRET_KEY (see the Overview page for the steps), then reload."
            : res.message || "Supabase didn’t answer. Try again in a moment."}
        </p>
      </div>
    );
  }
  const { users, generatedAt, totals } = res.data;
  return (
    <div className="grid gap-6">
      <header className="grid gap-1.5">
        <h1 className="m-0 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-bold tracking-[-.03em]">Users</h1>
        <p className="m-0 text-muted">{totals.users} accounts · {totals.active7} active this week. Visible to admins only.</p>
      </header>
      <UsersTable users={users} now={generatedAt} />
    </div>
  );
}
