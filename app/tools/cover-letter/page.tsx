import type { Metadata } from "next";
import { TemplateTool } from "@/components/tools/TemplateTool";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("cover-letter");

export default function CoverLetterPage() {
  return <ToolPage slug="cover-letter"><TemplateTool slug="cover-letter" /></ToolPage>;
}
