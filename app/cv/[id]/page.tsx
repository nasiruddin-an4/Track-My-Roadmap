import type { Metadata } from "next";
import { Suspense } from "react";
import { CvEditor } from "@/components/cv/CvEditor";
import { cvAiConfigured } from "@/lib/cv/ai";
import { SignInGate } from "@/components/SignInGate";
import { isSignedIn } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit CV", robots: { index: false, follow: false } };

/** One CV in the editor. The CV itself is loaded in the browser from /api/cv/:id, which checks it's yours. */
export default function CvEditPage({ params }: PageProps<"/cv/[id]">) {
  return (
    <Suspense fallback={<div className="wrap py-24 text-center text-muted" aria-busy="true">Opening your CV…</div>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/cv/[id]">["params"] }) {
  if (!(await isSignedIn())) {
    return <SignInGate title="your CV" heading="Sign in to edit your CV" backHref="/cv" backLabel="Back to the CV Builder" />;
  }
  const { id } = await params;
  // the ATS check and AI writing help only show when the AI key is set (lib/cv/ai.ts)
  return <CvEditor id={id} ai={cvAiConfigured()} />;
}
