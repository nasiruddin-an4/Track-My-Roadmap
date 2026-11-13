import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { cardRoadmaps, decodeCard, roadmapCardView, type AnyCard } from "@/lib/roadCard";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/* The public page behind a shared Road Card link. Social sites read its tags and show the card image as the preview. */

type Props = { params: Promise<{ token: string }> };

function summary(d: AnyCard) {
  if (d.k === "r") {
    const v = roadmapCardView(d);
    return v.pct >= 100
      ? `Completed the ${v.title} roadmap: all ${d.t} topics across ${v.states.length} phases. Free tech career roadmaps on Track My Roadmap.`
      : `${v.pct}% through the ${v.title} roadmap: ${d.d} of ${d.t} topics${v.current ? `, now on Phase ${v.current.num}: ${v.current.title}` : ""}. Free tech career roadmaps on Track My Roadmap.`;
  }
  const top = cardRoadmaps(d)[0];
  return `${d.t} topics completed across ${d.r} ${d.r === 1 ? "roadmap" : "roadmaps"}${top ? `, including ${top.title} (${top.pct}%)` : ""}. Free tech career roadmaps and a habit tracker.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const d = decodeCard(token);
  if (!d) return { title: "Road Card", robots: { index: false } };
  const title = d.k === "r" ? `${d.n}’s ${roadmapCardView(d).title} Road Card` : `${d.n}’s Road Card`;
  const url = `${SITE_URL}/card/${token}`;
  const image = {
    url: `${url}/image`,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: `${d.n}’s learning progress on ${SITE_NAME}`,
  };
  return {
    title,
    description: summary(d),
    robots: { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, title: `${title} | ${SITE_NAME}`, description: summary(d), url, images: [image] },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description: summary(d), images: [image.url] },
  };
}

export default function CardPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="wrap py-24 text-center text-muted" aria-busy="true">Loading the Road Card…</div>}>
      <Card params={params} />
    </Suspense>
  );
}

async function Card({ params }: Props) {
  const { token } = await params;
  const d = decodeCard(token);
  if (!d) notFound();
  const first = d.n.split(/\s+/)[0];
  return (
    <>
      <div className="wrap grid justify-items-center gap-7 py-12 text-center sm:py-16">
        <div className="grid gap-2">
          <span className="eyebrow">Road Card</span>
          <h1 className="m-0 font-display text-[clamp(1.9rem,4.5vw,2.8rem)] leading-tight font-bold tracking-[-.03em]">
            {d.k === "r" ? `${first} is learning ${roadmapCardView(d).title}` : `${first} is learning on Track My Roadmap`}
          </h1>
          <p className="m-0 mx-auto max-w-[56ch] text-muted">{summary(d)}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/card/${token}/image`} width={1200} height={630} alt={`${d.n}’s Road Card`}
          className="h-auto w-full max-w-[920px] rounded-[20px] border border-line shadow-[var(--shadow)]" />
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={d.k === "r" ? `/roadmaps/${d.rm}` : "/roadmaps"} className="btn primary">{d.k === "r" ? `Start the ${roadmapCardView(d).title} roadmap` : "Start your own roadmap"}</Link>
          <Link href="/signup" className="btn">Create a free account</Link>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
