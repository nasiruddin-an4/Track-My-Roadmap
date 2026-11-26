import type { Metadata } from "next";
import { ImageBatch } from "@/components/tools/ImageBatch";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("convert-image");

export default function ConvertImagePage() {
  return <ToolPage slug="convert-image"><ImageBatch mode="convert" /></ToolPage>;
}
