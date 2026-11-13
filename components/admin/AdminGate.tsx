import { notFound } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import type { AdminCheck } from "@/lib/supabase/admin";

/** What a visitor sees instead of an admin page. Non-admins get a plain 404, so the page doesn't advertise itself. */
export function AdminGate({ check }: { check: Exclude<AdminCheck, { ok: true }> }) {
  if (check.reason === "not-admin") notFound();
  return (
    <div className="wrap grid place-items-center py-16 sm:py-24">
      <div className="grid w-full max-w-[460px] gap-4 rounded-[22px] border border-line bg-surface p-7 sm:p-9">
        <h1 className="m-0 font-display text-[1.7rem] leading-tight font-bold tracking-[-.03em]">Admin</h1>
        {check.reason === "signed-out" ? (
          <>
            <p className="m-0 text-muted">Sign in with your admin account to manage topic videos.</p>
            <SignInButton primary label="Continue with Google" className="w-full" />
          </>
        ) : check.reason === "not-set-up" ? (
          <>
            <p className="m-0 text-muted">
              The admin tables don’t exist yet. In Supabase → SQL Editor, run <code className="font-mono text-[.85em]">supabase/schema.sql</code>, then add your account:
            </p>
            <pre className="m-0 overflow-x-auto rounded-lg bg-bg p-3 font-mono text-[.78rem] leading-relaxed whitespace-pre-wrap">
              {"insert into public.admins (user_id)\nselect id from auth.users where email = 'you@example.com';"}
            </pre>
          </>
        ) : (
          <p className="m-0 text-muted">
            The admin dashboard needs Supabase. Add <code className="font-mono text-[.85em]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-[.85em]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code className="font-mono text-[.85em]">.env.local</code>.
          </p>
        )}
      </div>
    </div>
  );
}
