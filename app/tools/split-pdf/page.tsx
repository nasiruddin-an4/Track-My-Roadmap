import type { Metadata } from "next";
import { SplitPdf } from "@/components/tools/SplitPdf";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("split-pdf");

export default function SplitPdfPage() {
  return <ToolPage slug="split-pdf"><SplitPdf /></ToolPage>;
}
