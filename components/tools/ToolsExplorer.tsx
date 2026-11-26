"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Close, Search } from "@/components/icons";
import type { ToolGroup } from "@/lib/tools/registry";
import { useLocalItem } from "@/lib/useLocal";
import { RECENT_TOOLS_KEY } from "./RememberTool";
import { ToolCard, type CardTool } from "./ToolCard";
import { GROUP_TONE, ToolIcon } from "./ToolIcon";

export type ExplorerTool = CardTool & { keywords: string[] };
type Group = { key: ToolGroup; title: string; short: string; text: string };

/** Lower case, one form of Unicode, and "300×300" written like "300x300", so searches match however they're typed. */
const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/×/g, "x");

/**
 * The /tools list: search (English, Bengali and common words like "300x300" or "kb"), category chips, the tools
 * used most, the ones this visitor opened recently, then every tool by category.
 */
export function ToolsExplorer({ tools, groups, popular }: { tools: ExplorerTool[]; groups: Group[]; popular: string[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<ToolGroup | "all">("all");
  const input = useRef<HTMLInputElement>(null);

  // "/" jumps to the search box, as on the roadmap tracker
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName || "";
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  const haystack = useMemo(() => new Map(tools.map((t) => {
    const g = groups.find((x) => x.key === t.group);
    return [t.slug, norm([t.name, t.summary, t.bn, g?.title ?? "", ...t.keywords].join(" "))];
  })), [tools, groups]);

  const terms = norm(query).split(/\s+/).filter(Boolean);
  const found = tools.filter((t) => (cat === "all" || t.group === cat) && terms.every((w) => haystack.get(t.slug)!.includes(w)));
  const browsing = !terms.length && cat === "all";

  const recentRaw = useLocalItem(RECENT_TOOLS_KEY);
  const recent = useMemo(() => {
    try {
      const list = JSON.parse(recentRaw ?? "[]") as unknown;
      return Array.isArray(list) ? list.map((s) => tools.find((t) => t.slug === s)).filter((t): t is ExplorerTool => !!t).slice(0, 4) : [];
    } catch { return []; }
  }, [recentRaw, tools]);

  const count = (k: ToolGroup | "all") => (k === "all" ? tools.length : tools.filter((t) => t.group === k).length);
  const reset = () => { setQuery(""); setCat("all"); input.current?.focus(); };

  return (
    <div className="grid gap-10">
      {/* search and categories stay in reach while scrolling */}
      <div className="sticky top-(--top) z-10 -mx-4 grid gap-3 border-b border-line/70 bg-bg/90 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-2xl sm:border sm:bg-surface/85 sm:p-3">
        <label className="flex h-12 items-center gap-3 rounded-xl border border-line bg-bg px-3.5 text-muted transition-colors focus-within:border-route focus-within:shadow-[0_0_0_3px_var(--route-soft)]">
          <Search size={18} />
          <span className="vh">Search tools</span>
          <input ref={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search"
            onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
            placeholder="Search: compress PDF, 300x300, leave application, বিজয়…"
            className="h-full min-w-0 flex-1 bg-transparent text-[1rem] text-ink outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden" />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); input.current?.focus(); }} className="grid size-8 place-items-center rounded-lg hover:bg-sunk hover:text-ink"><Close /></button>
          ) : (
            <kbd aria-hidden="true" className="hidden rounded-md border border-line px-1.5 font-mono text-[.72rem] sm:inline">/</kbd>
          )}
        </label>
        <div role="radiogroup" aria-label="Category" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {([{ key: "all", short: "All tools" }, ...groups] as { key: ToolGroup | "all"; short: string }[]).map((g) => (
            <button key={g.key} type="button" role="radio" aria-checked={cat === g.key} onClick={() => setCat(g.key)}
              className={"inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[.9rem] font-semibold whitespace-nowrap transition-colors "
                + (cat === g.key ? "border-route bg-route text-route-ink" : "border-line bg-bg/60 text-muted hover:border-muted hover:text-ink")}>
              {g.short}
              <span className={"font-mono text-[.72rem] " + (cat === g.key ? "text-route-ink/70" : "text-muted/70")}>{count(g.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {browsing ? (
        <>
          {recent.length > 0 && (
            <section aria-labelledby="recentH" className="grid gap-3">
              <h2 id="recentH" className="m-0 text-[.8rem] font-semibold tracking-[.08em] text-muted uppercase">Recently used</h2>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {recent.map((t) => (
                  <li key={t.slug}>
                    <Link href={t.href ?? `/tools/${t.slug}`} className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pr-4 pl-1.5 font-semibold transition-colors hover:border-route">
                      <ToolIcon slug={t.slug} group={t.group} size={30} />
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="popularH" className="grid gap-4">
            <SectionTitle id="popularH" title="Most used" text="The tools people open most." />
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {popular.map((slug) => tools.find((t) => t.slug === slug)).filter((t): t is ExplorerTool => !!t).map((t) => (
                <li key={t.slug}><BigCard tool={t} /></li>
              ))}
            </ul>
          </section>

          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className="grid gap-4">
              <SectionTitle id={`g-${g.key}`} title={g.title} text={g.text} />
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {tools.filter((t) => t.group === g.key).map((t) => <li key={t.slug}><ToolCard tool={t} /></li>)}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <section aria-label="Matching tools" className="grid gap-4">
          <p className="m-0 text-[.95rem] text-muted" aria-live="polite">
            {found.length ? `${found.length} tool${found.length === 1 ? "" : "s"}` : "No tools match"}
            {terms.length ? <> for “<b className="text-ink">{query.trim()}</b>”</> : null}
            {cat !== "all" ? <> in <b className="text-ink">{groups.find((g) => g.key === cat)?.title}</b></> : null}
          </p>
          {found.length ? (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {found.map((t) => <li key={t.slug}><ToolCard tool={t} /></li>)}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
              <b className="font-display text-[1.2rem]">We don’t have that one yet</b>
              <p className="m-0 max-w-[46ch] text-muted">Try a shorter word, like “PDF”, “photo” or “letter”. Or tell us what you need and we’ll look at adding it.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className="btn" onClick={reset}>Show all tools</button>
                <a href="#feedback" className="btn primary">Suggest a tool</a>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SectionTitle({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <h2 id={id} className="m-0 font-display text-[1.5rem] font-bold tracking-[-.02em]">{title}</h2>
      <p className="m-0 text-[.94rem] text-muted">{text}</p>
    </div>
  );
}

/** A larger card for the most used tools, tinted with its category's colour. */
function BigCard({ tool }: { tool: ExplorerTool }) {
  const tone = GROUP_TONE[tool.group].split(" ").find((c) => c.startsWith("text-")) ?? "text-route";
  return (
    <Link href={tool.href ?? `/tools/${tool.slug}`}
      className="group relative isolate flex h-full flex-col gap-1.5 overflow-hidden rounded-[22px] border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-route hover:shadow-[0_16px_40px_rgba(0,0,0,.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route">
      <span aria-hidden="true" className={"pointer-events-none absolute -top-12 -right-12 -z-10 size-40 rounded-full bg-current opacity-[.09] blur-2xl transition-opacity group-hover:opacity-[.16] " + tone} />
      <span className="mb-4"><ToolIcon slug={tool.slug} group={tool.group} size={50} /></span>
      {/* titles line up across the row; "Open" sits at the bottom whatever the summary's length */}
      <b className="font-display text-[1.2rem] leading-tight tracking-[-.015em]">{tool.name}</b>
      <span className="text-[.9rem] leading-snug text-muted">{tool.summary}</span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[.9rem] font-semibold text-route">
        Open <span className="transition-transform group-hover:translate-x-0.5"><Arrow size={14} /></span>
      </span>
    </Link>
  );
}
