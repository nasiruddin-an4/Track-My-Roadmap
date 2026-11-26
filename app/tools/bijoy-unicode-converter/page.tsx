import type { Metadata } from "next";
import { BijoyConverter } from "@/components/tools/BijoyConverter";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";

export const metadata: Metadata = toolMeta("bijoy-unicode-converter");

export default function BijoyConverterPage() {
  return <ToolPage slug="bijoy-unicode-converter"><BijoyConverter /></ToolPage>;
}
