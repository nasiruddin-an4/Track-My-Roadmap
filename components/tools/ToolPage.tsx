import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, Chevron } from "@/components/icons";
import { SiteFooter } from "@/components/SiteFooter";
import { getTool, TOOL_GROUPS, TOOLS } from "@/lib/tools/registry";
import { pageMeta, SITE_NAME, SITE_URL } from "@/lib/site";
import { RememberTool } from "./RememberTool";
import { ToolCard } from "./ToolCard";
import { ToolIcon } from "./ToolIcon";

export function toolMeta(slug: string): Metadata {
  const t = getTool(slug);
  return { ...pageMeta(t.title, t.description, `/tools/${slug}`), keywords: t.keywords };
}

/** "Runs on your device" line, used on every tool page and on /tools. `ai`: the tool sends photos to the AI instead. */
export function OnDevice({ className = "", ai = false, text }: { className?: string; ai?: boolean; text?: string }) {
  return (
    <span className={"inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[.85rem] font-medium " + className}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-done">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      {text ?? (ai ? "Free with sign-in · Read by AI · Photos aren’t stored" : "Free · Works on your device · Files are never uploaded")}
    </span>
  );
}

/** Everything around a tool: heading, the tool itself, how to use it, a next step, FAQs and other tools. */
export function ToolPage({ slug, children }: { slug: string; children: React.ReactNode }) {
  const tool = getTool(slug);
  const group = TOOL_GROUPS.find((g) => g.key === tool.group)!;
  const related = [...TOOLS.filter((t) => t.slug !== slug && t.group === tool.group), ...TOOLS.filter((t) => t.group !== tool.group)].slice(0, 4);
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.heading,
    url: `${SITE_URL}/tools/${slug}`,
    description: tool.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (runs in the browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "BDT" },
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <RememberTool slug={slug} />
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="pt-6 text-[.88rem] text-muted sm:pt-8">
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
            <li><Link href="/tools" className="font-semibold hover:text-ink">Free tools</Link></li>
            <li aria-hidden="true" className="text-line"><Chevron size={14} /></li>
            <li aria-current="page" className="text-ink">{tool.name}</li>
          </ol>
        </nav>

        <header className="grid gap-3 pt-5 pb-6 sm:pb-8">
          <div className="flex items-center gap-3">
            <ToolIcon slug={slug} group={tool.group} size={40} />
            <span className="eyebrow">{group.title}</span>
          </div>
          <h1 className="m-0 font-display text-[clamp(2rem,5vw,3.1rem)] leading-[1.04] font-bold tracking-[-.035em] text-balance">{tool.heading}</h1>
          <p lang="bn" className="m-0 text-[1.05rem] text-muted">{tool.bn}</p>
          <OnDevice className="mt-1" ai={tool.onDevice === false} />
        </header>

        <section aria-label={tool.name} className="rounded-[24px] border border-line bg-surface p-4 shadow-(--shadow) sm:p-6 lg:p-8">
          {children}
        </section>

        <div className="grid gap-10 py-14 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <section aria-labelledby="howH" className="grid content-start gap-5">
            <h2 id="howH" className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">How to use it</h2>
            <ol className="m-0 grid list-none gap-4 p-0">
              {tool.steps.map((s, i) => (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-route-soft font-mono text-[.85rem] font-semibold text-route">{i + 1}</span>
                  <p className="m-0 pt-1 text-muted">{s}</p>
                </li>
              ))}
            </ol>
            <div className="mt-2 grid gap-3 rounded-2xl border border-line bg-band p-5">
              <p className="m-0">{tool.next.text}</p>
              <Link href={tool.next.href} className="btn primary w-fit">{tool.next.label} <Arrow /></Link>
            </div>
          </section>

          <section aria-labelledby="faqH" className="grid content-start gap-3">
            <h2 id="faqH" className="m-0 mb-2 font-display text-[1.6rem] font-bold tracking-[-.02em]">Questions</h2>
            <div className="grid">
              {tool.faq.map(([q, a]) => (
                <details key={q} className="group border-b border-line py-1 first:border-t">
                  <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="grid size-7 flex-none place-items-center rounded-full bg-sunk text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </summary>
                  <p className="m-0 max-w-[62ch] pb-4 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section aria-labelledby="moreH" className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="moreH" className="m-0 font-display text-[1.6rem] font-bold tracking-[-.02em]">More free tools</h2>
            <Link href="/tools" className="inline-flex items-center gap-1.5 text-[.95rem] font-semibold text-route hover:underline">All tools <Arrow size={14} /></Link>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((t) => <li key={t.slug}><ToolCard tool={t} compact /></li>)}
          </ul>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
