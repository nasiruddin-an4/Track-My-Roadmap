import type { Metadata } from "next";
import { TemplateTool } from "@/components/tools/TemplateTool";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("assignment-cover-page");

export default function AssignmentCoverPage() {
  return <ToolPage slug="assignment-cover-page"><TemplateTool slug="assignment-cover-page" /></ToolPage>;
}
