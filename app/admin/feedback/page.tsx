import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { FeedbackList } from "@/components/admin/FeedbackList";
import { listFeedback } from "@/lib/adminFeedback";
import { checkAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Feedback" };

/** What learners sent through the Feedback button, newest first. */
export default function AdminFeedbackPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted" aria-busy="true">Loading…</div>}>
      <Feedback />
    </Suspense>
  );
}

async function Feedback() {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate check={check} />;
  const res = await listFeedback();
  return (
    <div className="grid gap-6">
      <header className="grid gap-1.5">
        <h1 className="m-0 font-display text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-bold tracking-[-.03em]">Feedback</h1>
        <p className="m-0 text-muted">Sent by signed-in learners from the Feedback button on every page.</p>
      </header>
      {res.ok ? (
        <FeedbackList initial={res.items} now={res.now} named={res.named} />
      ) : (
        <div className="grid max-w-[640px] gap-2 rounded-2xl border border-line bg-surface p-6">
          <h2 className="m-0 text-[1.15rem] font-bold">{res.reason === "not-set-up" ? "One step to switch feedback on" : "Couldn’t load feedback"}</h2>
          <p className="m-0 text-muted">
            {res.reason === "not-set-up"
              ? "Run the latest supabase/schema.sql in Supabase → SQL Editor (it adds the feedback table). Then reload."
              : res.message || "Supabase didn’t answer. Try again in a moment."}
          </p>
        </div>
      )}
    </div>
  );
}
