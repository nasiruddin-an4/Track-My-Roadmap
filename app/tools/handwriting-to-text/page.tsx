import type { Metadata } from "next";
import { NotesReader } from "@/components/tools/NotesReader";
import { ToolPage, toolMeta } from "@/components/tools/ToolPage";
import { LIMITS, notesAiConfigured } from "@/lib/tools/notesAi";

export const metadata: Metadata = toolMeta("handwriting-to-text");

export default function HandwritingToTextPage() {
  return (
    <ToolPage slug="handwriting-to-text">
      <NotesReader enabled={notesAiConfigured()} readLimit={LIMITS.read.perDay()} studyLimit={LIMITS.study.perDay()} />
    </ToolPage>
  );
}
