import { SiteFooter } from "@/components/SiteFooter";

/** Layout for the Privacy Policy and Terms pages: a readable single column of text. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <article className="wrap max-w-[760px] pt-12 pb-4 sm:pt-16 [&_a]:font-semibold [&_a]:text-route [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:mt-2 [&_p]:my-3 [&_ul]:my-3 [&_ul]:pl-5 [&_ul]:list-disc">
        <header className="mb-8 grid gap-2">
          <span className="eyebrow">Last updated {updated}</span>
          <h1 className="m-0 font-display text-[clamp(2rem,4.5vw,2.8rem)] leading-tight font-bold tracking-[-.03em]">{title}</h1>
        </header>
        <div className="leading-relaxed text-ink/90">{children}</div>
      </article>
      <SiteFooter />
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="m-0 font-display text-[1.3rem] font-bold tracking-[-.01em]">{title}</h2>
      {children}
    </section>
  );
}
