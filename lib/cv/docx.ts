import "server-only";
import { BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { layoutCv, type Run } from "@/lib/cv/format";
import type { CvData, PageSize } from "@/lib/cv/schema";

/*
 * The "classic" template as a Word file, drawn from layoutCv() (lib/cv/format.ts) like the PDF and preview.
 * Same ATS rules: one column of plain paragraphs (no tables, text boxes, columns or images), contact details in the
 * body rather than a Word header, standard section names, Arial, black text, plain "•" bullets.
 * Sizes are in half-points (21 = 10.5pt); page sizes and margins in twentieths of a point.
 */
const FONT = "Arial", INK = "111111", SUB = "444444";
const PAGE = { a4: { width: 11906, height: 16838 }, letter: { width: 12240, height: 15840 } } as const;

const runs = (line: Run[], size = 21) => line.map((r) => new TextRun({ text: r.text, bold: r.bold, font: FONT, size, color: INK }));
const para = (children: TextRun[], opts: { before?: number; after?: number } = {}) =>
  new Paragraph({ children, spacing: { before: opts.before ?? 0, after: opts.after ?? 40, line: 276 } });

export async function renderCvDocx(data: CvData, pageSize: PageSize, title: string): Promise<Buffer> {
  const l = layoutCv(data);
  const body: Paragraph[] = [];
  if (l.name) body.push(para([new TextRun({ text: l.name, bold: true, font: FONT, size: 40, color: INK })], { after: 20 }));
  if (l.label) body.push(para([new TextRun({ text: l.label, font: FONT, size: 23, color: SUB })], { after: 20 }));
  if (l.contact) body.push(para([new TextRun({ text: l.contact, font: FONT, size: 20, color: SUB })], { after: 60 }));

  for (const sec of l.sections) {
    body.push(new Paragraph({
      children: [new TextRun({ text: sec.title.toUpperCase(), bold: true, font: FONT, size: 24, color: INK, characterSpacing: 12 })],
      spacing: { before: 260, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 2 } },
      keepNext: true,
    }));
    if (sec.kind === "lines") {
      for (const line of sec.lines) body.push(para(runs(line)));
      continue;
    }
    sec.entries.forEach((e, i) => {
      // space between entries comes from the heading line, so there are no blank paragraphs for an ATS to trip on
      body.push(new Paragraph({ children: runs(e.head), spacing: { before: i ? 160 : 0, after: 0, line: 276 }, keepNext: true }));
      if (e.meta) body.push(para([new TextRun({ text: e.meta, font: FONT, size: 20, color: SUB })], { after: 20 }));
      for (const p of e.paras) body.push(para(runs([{ text: p }])));
      for (const b of e.bullets) {
        // a plain "• " (no tab or Word list numbering), with a hanging indent so wrapped lines line up
        body.push(new Paragraph({
          children: [new TextRun({ text: `•  ${b}`, font: FONT, size: 21, color: INK })],
          indent: { left: 300, hanging: 220 },
          spacing: { before: 20, after: 0, line: 276 },
        }));
      }
    });
  }

  const doc = new Document({
    title, creator: "Track My Roadmap", description: l.label || "CV",
    styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
    sections: [{
      properties: { page: { size: PAGE[pageSize], margin: { top: 800, bottom: 800, left: 920, right: 920 } } },
      children: body,
    }],
  });
  return Packer.toBuffer(doc);
}
