import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RoadmapTracker } from "@/components/roadmap/RoadmapTracker";
import { SignInGate } from "@/components/SignInGate";
import { SiteFooter } from "@/components/SiteFooter";
import { ROADMAPS } from "@/content/roadmaps";
import { getRoadmap } from "@/content/roadmaps";
import { getTopicResources } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/supabase/server";

export function generateStaticParams() {
  return ROADMAPS.map((r) => ({ slug: r.def.slug }));
}

export async function generateMetadata({ params }: PageProps<"/roadmaps/[slug]/track">): Promise<Metadata> {
  const rm = getRoadmap((await params).slug);
  if (!rm) return {};
  return { title: `Track: ${rm.def.title} roadmap`, robots: { index: false }, alternates: { canonical: `/roadmaps/${rm.def.slug}` } };
}

/** The tracker for one roadmap. The server checks the sign-in first, so the full roadmap is only sent to signed-in visitors. */
export default function TrackPage({ params }: PageProps<"/roadmaps/[slug]/track">) {
  return (
    <Suspense fallback={<div className="wrap py-24 text-center text-muted" aria-busy="true">Loading the roadmap…</div>}>
      <Tracker params={params} />
    </Suspense>
  );
}

async function Tracker({ params }: { params: PageProps<"/roadmaps/[slug]/track">["params"] }) {
  const rm = getRoadmap((await params).slug);
  if (!rm) notFound();
  const viewer = await getViewer();
  if (!viewer.signedIn) {
    return <SignInGate title={`the ${rm.def.title} roadmap`} backHref={`/roadmaps/${rm.def.slug}`} backLabel="Back to the roadmap overview" />;
  }
  const resources = await getTopicResources(rm.def.slug);
  return (
    <>
      <RoadmapTracker def={rm.def} resources={resources} />
      <SiteFooter note={rm.def.credit?.text} />
    </>
  );
}
