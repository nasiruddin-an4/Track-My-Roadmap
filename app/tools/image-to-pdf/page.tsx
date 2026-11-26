import type { Metadata } from "next";
import { ImageToPdf } from "@/components/tools/ImageToPdf";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("image-to-pdf");

export default function ImageToPdfPage() {
  return <ToolPage slug="image-to-pdf"><ImageToPdf /></ToolPage>;
}
