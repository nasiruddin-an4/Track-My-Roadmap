import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { ResourceEditor } from "@/components/admin/ResourceEditor";
import { getRoadmap } from "@/content/roadmaps";
import { checkAdmin, listTopicResources } from "@/lib/supabase/admin";

export async function generateMetadata({ params }: PageProps<"/admin/videos/[slug]">): Promise<Metadata> {
  const rm = getRoadmap((await params).slug);
  return rm ? { title: rm.def.title } : { title: "Page not found", robots: { index: false } };
}

/** Admin editor for one roadmap's topic videos. */
export default function AdminRoadmapPage({ params }: PageProps<"/admin/videos/[slug]">) {
  return (
    <Suspense fallback={<div className="py-24 text-center text-muted" aria-busy="true">Loading…</div>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/admin/videos/[slug]">["params"] }) {
  const check = await checkAdmin();
  if (!check.ok) return <AdminGate check={check} />;
  const rm = getRoadmap((await params).slug);
  if (!rm) notFound();
  const rows = await listTopicResources(rm.def.slug);
  return <ResourceEditor def={rm.def} initial={rows} />;
}
