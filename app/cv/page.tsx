import type { Metadata } from "next";
import { Suspense } from "react";
import { CvList } from "@/components/cv/CvList";
import { cvAiConfigured } from "@/lib/cv/ai";
import { SignInGate } from "@/components/SignInGate";
import { SiteFooter } from "@/components/SiteFooter";
import { isSignedIn } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CV Builder", robots: { index: false, follow: false } };

/** The signed-in person's CVs. Private: checked on the server, so signed-out visitors get the sign-in card. */
export default function CvPage() {
  return (
    <Suspense fallback={<div className="wrap py-24 text-center text-muted" aria-busy="true">Loading your CVs…</div>}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  if (!(await isSignedIn())) {
    return <SignInGate title="your CV" heading="Sign in to build your CV" backHref="/account/profile" backLabel="Back to your profile" />;
  }
  return (
    <>
      {/* importing a CV needs the AI key; without it the page offers "start from scratch" only */}
      <CvList ai={cvAiConfigured()} />
      <SiteFooter note="Your CVs are private to your account." />
    </>
  );
}
