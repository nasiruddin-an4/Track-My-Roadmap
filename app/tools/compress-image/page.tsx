import type { Metadata } from "next";
import { ImageBatch } from "@/components/tools/ImageBatch";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("compress-image");

export default function CompressImagePage() {
  return <ToolPage slug="compress-image"><ImageBatch mode="compress" /></ToolPage>;
}
