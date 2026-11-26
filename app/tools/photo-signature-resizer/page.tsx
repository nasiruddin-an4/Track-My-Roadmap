import type { Metadata } from "next";
import { PhotoSignatureResizer } from "@/components/tools/PhotoSignatureResizer";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("photo-signature-resizer");

export default function PhotoSignatureResizerPage() {
  return <ToolPage slug="photo-signature-resizer"><PhotoSignatureResizer /></ToolPage>;
}
