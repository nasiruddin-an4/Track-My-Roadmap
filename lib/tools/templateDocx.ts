/*
 * A template's blocks (lib/tools/templates.ts) as a Word file, built in the browser. Times New Roman for English;
 * Bengali takes Word's "complex script" font, Nirmala UI (part of Windows), with bold and size set for it too.
 * The docx library loads only when someone downloads.
 */
import type { Block, Lang } from "./templates";

/** Width and height of an image given as a data URL. */
function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("The logo couldn’t be read."));
    img.src = src;
  });
}

export async function blocksToDocx(blocks: Block[], lang: Lang, title: string): Promise<Blob> {
  const { AlignmentType, Document, ImageRun, Packer, Paragraph, Table, TableBorders, TableCell, TableRow, TextRun, WidthType } = await import("docx");
  const bn = lang === "bn";
  const font = bn ? { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Nirmala UI" } : "Times New Roman";
  const run = (text: string, bold = false, size = 12) => new TextRun({
    text, bold, font, size: size * 2,
    ...(bn ? { boldComplexScript: bold, sizeComplexScript: size * 2, language: { value: "en-US", bidirectional: "bn-BD" } } : {}),
  });
  const line = bn ? 320 : 276; // Bengali vowel signs need taller lines
  const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT };
  const pt = (n?: number) => Math.round((n ?? 0) * 20);

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  for (const b of blocks) {
    if (b.t === "p") {
      children.push(new Paragraph({
        alignment: ALIGN[b.align ?? "left"],
        spacing: { before: pt(b.gap), after: 0, line },
        children: b.runs.map((r) => run(r.text, r.bold, b.size)),
      }));
    } else if (b.t === "bullets") {
      b.items.forEach((item, i) => children.push(new Paragraph({
        indent: { left: 360, hanging: 240 },
        spacing: { before: i ? 40 : pt(b.gap), after: 0, line },
        children: [run(`•  ${item}`)],
      })));
    } else if (b.t === "image") {
      const { w, h } = await imageSize(b.src);
      const width = Math.round((b.width * 96) / 72);
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: pt(b.gap), after: 0 },
        children: [new ImageRun({ type: "png", data: b.src, transformation: { width, height: Math.round((width * h) / w) } })],
      }));
    } else {
      children.push(new Paragraph({ spacing: { before: pt(b.gap), after: 0 }, children: [] }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TableBorders.NONE,
        rows: [new TableRow({
          children: b.cols.map((c) => new TableCell({
            width: { size: Math.floor(100 / b.cols.length), type: WidthType.PERCENTAGE },
            borders: TableBorders.NONE,
            children: [
              new Paragraph({ spacing: { after: 80, line }, children: [run(c.title, true, 12)] }),
              ...c.lines.map((l) => new Paragraph({ spacing: { after: 0, line }, children: l.map((r) => run(r.text, r.bold)) })),
            ],
          })),
        })],
      }));
    }
  }

  const doc = new Document({
    title, creator: "Track My Roadmap",
    styles: { default: { document: { run: { font, size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
      children,
    }],
  });
  return Packer.toBlob(doc);
}
