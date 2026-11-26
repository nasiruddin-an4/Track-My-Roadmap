import "server-only";
import { BorderStyle, Document, Packer, Paragraph, TextRun } from "docx";
import { layoutCv, type Run } from "@/lib/cv/format";
import type { CvData, CvLocale, PageSize } from "@/lib/cv/schema";

/*
 * The "classic" template as a Word file, drawn from layoutCv() (lib/cv/format.ts) like the PDF and preview.
 * Same ATS rules: one column of plain paragraphs (no tables, text boxes, columns or images), contact details in the
 * body rather than a Word header, standard section names, Arial, black text, plain "•" bullets.
 * Bengali CVs: Word shapes Bengali itself and takes its font from the "complex script" slot, set to Nirmala UI
 * (part of Windows); Latin letters stay Arial. Bold and size are set for that slot too, or Bengali would ignore them.
 * Sizes are in half-points (21 = 10.5pt); page sizes and margins in twentieths of a point.
 */
const FONT = "Arial", BN_FONT = "Nirmala UI", INK = "111111", SUB = "444444";
const PAGE = { a4: { width: 11906, height: 16838 }, letter: { width: 12240, height: 15840 } } as const;

type RunOpts = { bold?: boolean; size?: number; color?: string; characterSpacing?: number };

function runMaker(locale: CvLocale) {
  const bn = locale === "bn";
  const font = bn ? { ascii: FONT, hAnsi: FONT, cs: BN_FONT } : FONT;
  return (text: string, o: RunOpts = {}) => new TextRun({
    text, font, bold: o.bold, size: o.size ?? 21, color: o.color ?? INK,
    ...(bn ? { boldComplexScript: o.bold, sizeComplexScript: o.size ?? 21, language: { value: "en-US", bidirectional: "bn-BD" } } : {}),
    // letter spacing would pull joined Bengali letters apart
    ...(o.characterSpacing && !bn ? { characterSpacing: o.characterSpacing } : {}),
  });
}

const para = (children: TextRun[], opts: { before?: number; after?: number; line?: number } = {}) =>
  new Paragraph({ children, spacing: { before: opts.before ?? 0, after: opts.after ?? 40, line: opts.line ?? 276 } });

export async function renderCvDocx(data: CvData, pageSize: PageSize, title: string): Promise<Buffer> {
  const l = layoutCv(data);
  const run = runMaker(l.locale);
  // Bengali vowel signs need taller lines
  const line = l.locale === "bn" ? 300 : 276;
  const runs = (r: Run[], size = 21) => r.map((x) => run(x.text, { bold: x.bold, size }));
  const body: Paragraph[] = [];
  if (l.name) body.push(para([run(l.name, { bold: true, size: 40 })], { after: 20, line }));
  if (l.label) body.push(para([run(l.label, { size: 23, color: SUB })], { after: 20, line }));
  if (l.contact) body.push(para([run(l.contact, { size: 20, color: SUB })], { after: 60, line }));

  for (const sec of l.sections) {
    body.push(new Paragraph({
      children: [run(sec.title.toUpperCase(), { bold: true, size: 24, characterSpacing: 12 })],
      spacing: { before: 260, after: 100, line },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 2 } },
      keepNext: true,
    }));
    if (sec.kind === "lines") {
      for (const r of sec.lines) body.push(para(runs(r), { line }));
      continue;
    }
    sec.entries.forEach((e, i) => {
      // space between entries comes from the heading line, so there are no blank paragraphs for an ATS to trip on
      body.push(new Paragraph({ children: runs(e.head), spacing: { before: i ? 160 : 0, after: 0, line }, keepNext: true }));
      if (e.meta) body.push(para([run(e.meta, { size: 20, color: SUB })], { after: 20, line }));
      for (const p of e.paras) body.push(para(runs([{ text: p }]), { line }));
      for (const b of e.bullets) {
        // a plain "• " (no tab or Word list numbering), with a hanging indent so wrapped lines line up
        body.push(new Paragraph({
          children: [run(`•  ${b}`)],
          indent: { left: 300, hanging: 220 },
          spacing: { before: 20, after: 0, line },
        }));
      }
    });
  }

  const doc = new Document({
    title, creator: "Track My Roadmap", description: l.label || "CV",
    styles: { default: { document: { run: { font: l.locale === "bn" ? { ascii: FONT, hAnsi: FONT, cs: BN_FONT } : FONT, size: 21, color: INK } } } },
    sections: [{
      properties: { page: { size: PAGE[pageSize], margin: { top: 800, bottom: 800, left: 920, right: 920 } } },
      children: body,
    }],
  });
  return Packer.toBuffer(doc);
}
