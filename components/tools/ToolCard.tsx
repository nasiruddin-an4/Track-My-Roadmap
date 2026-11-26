import Link from "next/link";
import { Arrow } from "@/components/icons";
import type { ToolGroup } from "@/lib/tools/registry";
import { ToolIcon } from "./ToolIcon";

/** What a card needs: a tool from the registry, or a site feature listed with them (the CV builder). */
export type CardTool = { slug: string; name: string; summary: string; bn: string; group: ToolGroup; href?: string; badge?: string };

/** A tool in a grid: icon, name, what it does (in English and Bengali). */
export function ToolCard({ tool, compact = false }: { tool: CardTool; compact?: boolean }) {
  return (
    <Link href={tool.href ?? `/tools/${tool.slug}`}
      className="group grid h-full content-start gap-3 rounded-2xl border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-route hover:shadow-[0_12px_30px_rgba(0,0,0,.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route">
      <span className="flex items-start justify-between gap-3">
        <ToolIcon slug={tool.slug} group={tool.group} size={compact ? 38 : 44} />
        <span className="flex items-center gap-2">
          {tool.badge && <span className="rounded-full bg-sunk px-2 py-0.5 text-[.72rem] font-semibold text-muted">{tool.badge}</span>}
          <span className="grid size-8 place-items-center rounded-full border border-line text-muted transition group-hover:border-route group-hover:bg-route group-hover:text-bg">
            <Arrow size={14} />
          </span>
        </span>
      </span>
      <span className="grid gap-1">
        <b className="font-display text-[1.08rem] leading-tight tracking-[-.01em]">{tool.name}</b>
        <span className="text-[.88rem] leading-snug text-muted">{tool.summary}</span>
        {!compact && <span lang="bn" className="text-[.84rem] text-muted/80">{tool.bn}</span>}
      </span>
    </Link>
  );
}
