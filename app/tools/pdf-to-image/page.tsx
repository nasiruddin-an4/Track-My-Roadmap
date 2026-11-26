import type { Metadata } from "next";
import { PdfToImage } from "@/components/tools/PdfToImage";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("pdf-to-image");

export default function PdfToImagePage() {
  return <ToolPage slug="pdf-to-image"><PdfToImage /></ToolPage>;
}
