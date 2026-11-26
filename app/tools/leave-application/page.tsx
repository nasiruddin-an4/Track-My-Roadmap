import type { Metadata } from "next";
import { TemplateTool } from "@/components/tools/TemplateTool";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("leave-application");

export default function LeaveApplicationPage() {
  return <ToolPage slug="leave-application"><TemplateTool slug="leave-application" /></ToolPage>;
}
