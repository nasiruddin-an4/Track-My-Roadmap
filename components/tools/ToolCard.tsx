import Link from "next/link";
import { Arrow } from "@/components/icons";
import type { Tool } from "@/lib/tools/registry";
import { ToolIcon } from "./ToolIcon";

/** A tool in a grid: icon, name, what it does (in English and Bengali). */
export function ToolCard({ tool, compact = false }: { tool: Tool; compact?: boolean }) {
  return (
    <Link href={`/tools/${tool.slug}`}
      className="group grid h-full content-start gap-3 rounded-2xl border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-route hover:shadow-[0_12px_30px_rgba(0,0,0,.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route">
      <span className="flex items-start justify-between gap-3">
        <ToolIcon slug={tool.slug} group={tool.group} size={compact ? 38 : 44} />
        <span className="grid size-8 place-items-center rounded-full border border-line text-muted transition group-hover:border-route group-hover:bg-route group-hover:text-bg">
          <Arrow size={14} />
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
