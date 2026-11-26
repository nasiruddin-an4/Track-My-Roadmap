import type { Metadata } from "next";
import { MergePdf } from "@/components/tools/MergePdf";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("merge-pdf");

export default function MergePdfPage() {
  return <ToolPage slug="merge-pdf"><MergePdf /></ToolPage>;
}
