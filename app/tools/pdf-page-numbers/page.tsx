import type { Metadata } from "next";
import { PdfPageNumbers } from "@/components/tools/PdfPageNumbers";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("pdf-page-numbers");

export default function PdfPageNumbersPage() {
  return <ToolPage slug="pdf-page-numbers"><PdfPageNumbers /></ToolPage>;
}
