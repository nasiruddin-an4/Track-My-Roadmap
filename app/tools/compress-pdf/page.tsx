import type { Metadata } from "next";
import { CompressPdf } from "@/components/tools/CompressPdf";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("compress-pdf");

export default function CompressPdfPage() {
  return <ToolPage slug="compress-pdf"><CompressPdf /></ToolPage>;
}
