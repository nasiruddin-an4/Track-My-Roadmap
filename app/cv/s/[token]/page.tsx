import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CvPreview } from "@/components/cv/CvPreview";
import { getSharedCv } from "@/lib/cv/repo";
import { readCvData } from "@/lib/cv/schema";
import { supabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shared CV", robots: { index: false, follow: false } };

/** A CV its owner has shared with a link. Read-only; gone as soon as the owner turns the link off. */
export default function SharedCvPage({ params }: PageProps<"/cv/s/[token]">) {
  return (
    <Suspense fallback={<div className="wrap py-24 text-center text-muted" aria-busy="true">Opening CV…</div>}>
      <Shared params={params} />
    </Suspense>
  );
}

async function Shared({ params }: { params: PageProps<"/cv/s/[token]">["params"] }) {
  const { token } = await params;
  let cv: Awaited<ReturnType<typeof getSharedCv>> = null;
  if (supabaseConfigured) {
    try { cv = await getSharedCv(await createServerSupabase(), token); } catch (e) { console.error("cv shared page:", (e as Error).message); }
  }
  if (!cv) {
    return (
      <div className="wrap grid place-items-center py-24">
        <div className="grid max-w-[440px] gap-3 rounded-[22px] border border-line bg-surface p-8 text-center">
          <h1 className="m-0 font-display text-[1.5rem] font-bold">This CV isn’t shared</h1>
          <p className="m-0 text-muted">The link has been turned off, or it isn’t quite right. Ask the person for a new link.</p>
        </div>
      </div>
    );
  }
  const data = readCvData(cv.data);
  return (
    <div className="wrap mx-auto grid max-w-[900px] gap-5 py-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">{data.basics.name || "CV"}</h1>
          {data.basics.label && <p className="m-0 text-muted">{data.basics.label}</p>}
        </div>
        <a href={`/api/cv/shared/${token}/pdf`} className="inline-flex h-11 items-center rounded-xl bg-highlight px-5 font-semibold text-white hover:brightness-110">↓ Download PDF</a>
      </header>
      <CvPreview data={data} pageSize={cv.pageSize} />
      <p className="m-0 text-center text-[.88rem] text-muted">
        Made with the <Link href="/cv" className="font-semibold text-route hover:underline">Track My Roadmap CV Builder</Link>
      </p>
    </div>
  );
}
