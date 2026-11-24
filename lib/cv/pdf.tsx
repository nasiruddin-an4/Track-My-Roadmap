import "server-only";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { layoutCv, type Entry, type LaidSection, type Run } from "@/lib/cv/format";
import type { CvData, PageSize } from "@/lib/cv/schema";

/*
 * The "classic" template as a PDF, drawn from layoutCv() (lib/cv/format.ts), the same lines as the preview and
 * the Word file. Built for applicant tracking systems: one column top to bottom, real selectable text in reading
 * order, standard section names, contact details in the page body (not a PDF header), Helvetica (a standard PDF
 * font: no font files, nothing to embed), black on white, "•" bullets. No tables, images, icons or skill bars.
 */

// never split words with hyphens: an ATS would read "Java-" and "Script" as two words
Font.registerHyphenationCallback((word) => [word]);

const INK = "#111111", SUB = "#444444";

const s = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 46, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.35, color: INK },
  name: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.15 },
  label: { fontSize: 11.5, marginTop: 2, color: SUB },
  contact: { fontSize: 10, marginTop: 4, color: SUB },
  section: { marginTop: 13 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, paddingBottom: 2, marginBottom: 5, borderBottomWidth: 0.8, borderBottomColor: INK },
  item: { marginBottom: 7 },
  bold: { fontFamily: "Helvetica-Bold" },
  meta: { color: SUB, fontSize: 10 },
  line: { marginBottom: 2 },
  bullet: { flexDirection: "row", marginTop: 1.5, paddingLeft: 4 },
  dot: { width: 10 },
  bulletText: { flex: 1 },
});

/** Runs on one line of text, so they're read in order. */
const Line = ({ runs, style }: { runs: Run[]; style?: typeof s.line }) => (
  <Text style={style}>{runs.map((r, i) => (r.bold ? <Text key={i} style={s.bold}>{r.text}</Text> : r.text))}</Text>
);

function EntryView({ e }: { e: Entry }) {
  return (
    <View style={s.item}>
      <Line runs={e.head} />
      {e.meta && <Text style={s.meta}>{e.meta}</Text>}
      {e.paras.map((p, i) => <Text key={i}>{p}</Text>)}
      {e.bullets.map((b, i) => (
        <View key={i} style={s.bullet} wrap={false}><Text style={s.dot}>•</Text><Text style={s.bulletText}>{b}</Text></View>
      ))}
    </View>
  );
}

function SectionView({ sec }: { sec: LaidSection }) {
  return (
    <View style={s.section}>
      {/* keep a heading with the start of its section */}
      <Text style={s.heading} minPresenceAhead={30}>{sec.title}</Text>
      {sec.kind === "lines"
        ? sec.lines.map((l, i) => <Line key={i} runs={l} style={s.line} />)
        : sec.entries.map((e, i) => <EntryView key={i} e={e} />)}
    </View>
  );
}

export function CvDocument({ data, pageSize, title }: { data: CvData; pageSize: PageSize; title: string }) {
  const l = layoutCv(data);
  return (
    <Document title={title} author={l.name || undefined} subject={l.label || "CV"} creator="Track My Roadmap" producer="Track My Roadmap">
      <Page size={pageSize === "letter" ? "LETTER" : "A4"} style={s.page}>
        {l.name ? <Text style={s.name}>{l.name}</Text> : null}
        {l.label ? <Text style={s.label}>{l.label}</Text> : null}
        {l.contact ? <Text style={s.contact}>{l.contact}</Text> : null}
        {l.sections.map((sec) => <SectionView key={sec.key} sec={sec} />)}
      </Page>
    </Document>
  );
}

export function renderCvPdf(data: CvData, pageSize: PageSize, title: string): Promise<Buffer> {
  return renderToBuffer(<CvDocument data={data} pageSize={pageSize} title={title} />);
}
