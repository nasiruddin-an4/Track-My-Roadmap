import type { Metadata } from "next";
import { Suspense } from "react";
import { HabitTracker } from "@/components/habits/HabitTracker";
import { SignInGate } from "@/components/SignInGate";
import { SiteFooter } from "@/components/SiteFooter";
import { isSignedIn } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My habits",
  robots: { index: false },
  alternates: { canonical: "/habits" },
};

/** The habit tracker itself. Signed-in visitors only (checked on the server); habits are saved to their account. */
export default function HabitsTrackPage() {
  return (
    <Suspense fallback={<div className="wrap py-24 text-center text-muted" aria-busy="true">Loading your habits…</div>}>
      <Habits />
    </Suspense>
  );
}

async function Habits() {
  if (!(await isSignedIn())) {
    return <SignInGate title="your habits" backHref="/habits" backLabel="Back to the habit tracker overview" />;
  }
  return (
    <>
      <HabitTracker />
      <SiteFooter note="Your habits save automatically." />
    </>
  );
}
