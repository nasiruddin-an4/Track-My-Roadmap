import type { Metadata } from "next";
import { TemplateTool } from "@/components/tools/TemplateTool";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("testimonial-application");

export default function TestimonialApplicationPage() {
  return <ToolPage slug="testimonial-application"><TemplateTool slug="testimonial-application" /></ToolPage>;
}
