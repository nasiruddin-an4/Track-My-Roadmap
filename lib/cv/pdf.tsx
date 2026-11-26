import "server-only";
import path from "node:path";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { layoutCv, type Entry, type LaidSection, type Run } from "@/lib/cv/format";
import type { CvData, CvLocale, PageSize } from "@/lib/cv/schema";

/*
 * The "classic" template as a PDF, drawn from layoutCv() (lib/cv/format.ts), the same lines as the preview and
 * the Word file. Built for applicant tracking systems: one column top to bottom, real selectable text in reading
 * order, standard section names, contact details in the page body (not a PDF header), black on white, "•" bullets.
 * No tables, images, icons or skill bars.
 * English CVs use Helvetica (a standard PDF font: nothing to embed). Bengali CVs embed Hind Siliguri (SIL Open Font
 * License, lib/cv/fonts), which has Bengali and Latin letters; react-pdf shapes its conjuncts, reph and vowel signs
 * the same way browsers do. next.config.ts ships the font files with the CV routes.
 */

// never split words with hyphens: an ATS would read "Java-" and "Script" as two words
Font.registerHyphenationCallback((word) => [word]);

const FONTS = path.join(process.cwd(), "lib/cv/fonts");
Font.register({
  family: "Hind Siliguri",
  fonts: [
    { src: path.join(FONTS, "HindSiliguri-Regular.ttf") },
    { src: path.join(FONTS, "HindSiliguri-Bold.ttf"), fontWeight: 700 },
  ],
});

const INK = "#111111", SUB = "#444444";

function styles(locale: CvLocale) {
  const bn = locale === "bn";
  const regular = bn ? { fontFamily: "Hind Siliguri" } : { fontFamily: "Helvetica" };
  const bold = bn ? { fontFamily: "Hind Siliguri", fontWeight: 700 as const } : { fontFamily: "Helvetica-Bold" };
  return StyleSheet.create({
    // Bengali vowel signs sit above and below the letters, so lines need more room
    page: { paddingVertical: 40, paddingHorizontal: 46, ...regular, fontSize: 10.5, lineHeight: bn ? 1.55 : 1.35, color: INK },
    name: { ...bold, fontSize: 20, lineHeight: bn ? 1.35 : 1.15 },
    label: { fontSize: 11.5, marginTop: 2, color: SUB },
    contact: { fontSize: 10, marginTop: 4, color: SUB },
    section: { marginTop: 13 },
    // spacing out Bengali letters would pull joined letters apart
    heading: { ...bold, fontSize: 12, textTransform: "uppercase", letterSpacing: bn ? 0 : 0.6, paddingBottom: 2, marginBottom: 5, borderBottomWidth: 0.8, borderBottomColor: INK },
    item: { marginBottom: 7 },
    bold,
    meta: { color: SUB, fontSize: 10 },
    line: { marginBottom: 2 },
    bullet: { flexDirection: "row", marginTop: 1.5, paddingLeft: 4 },
    dot: { width: 10 },
    bulletText: { flex: 1 },
  });
}

const STYLES = { en: styles("en"), bn: styles("bn") };
type S = (typeof STYLES)["en"];

/** Runs on one line of text, so they're read in order. */
const Line = ({ runs, s, style }: { runs: Run[]; s: S; style?: S["line"] }) => (
  <Text style={style}>{runs.map((r, i) => (r.bold ? <Text key={i} style={s.bold}>{r.text}</Text> : r.text))}</Text>
);

function EntryView({ e, s }: { e: Entry; s: S }) {
  return (
    <View style={s.item}>
      <Line runs={e.head} s={s} />
      {e.meta && <Text style={s.meta}>{e.meta}</Text>}
      {e.paras.map((p, i) => <Text key={i}>{p}</Text>)}
      {e.bullets.map((b, i) => (
        <View key={i} style={s.bullet} wrap={false}><Text style={s.dot}>•</Text><Text style={s.bulletText}>{b}</Text></View>
      ))}
    </View>
  );
}

function SectionView({ sec, s }: { sec: LaidSection; s: S }) {
  return (
    <View style={s.section}>
      {/* keep a heading with the start of its section */}
      <Text style={s.heading} minPresenceAhead={30}>{sec.title}</Text>
      {sec.kind === "lines"
        ? sec.lines.map((l, i) => <Line key={i} runs={l} s={s} style={s.line} />)
        : sec.entries.map((e, i) => <EntryView key={i} e={e} s={s} />)}
    </View>
  );
}

export function CvDocument({ data, pageSize, title }: { data: CvData; pageSize: PageSize; title: string }) {
  const l = layoutCv(data);
  const s = STYLES[l.locale];
  return (
    <Document title={title} author={l.name || undefined} subject={l.label || "CV"} creator="Track My Roadmap" producer="Track My Roadmap"
      language={l.locale === "bn" ? "bn-BD" : "en"}>
      <Page size={pageSize === "letter" ? "LETTER" : "A4"} style={s.page}>
        {l.name ? <Text style={s.name}>{l.name}</Text> : null}
        {l.label ? <Text style={s.label}>{l.label}</Text> : null}
        {l.contact ? <Text style={s.contact}>{l.contact}</Text> : null}
        {l.sections.map((sec) => <SectionView key={sec.key} sec={sec} s={s} />)}
      </Page>
    </Document>
  );
}

export function renderCvPdf(data: CvData, pageSize: PageSize, title: string): Promise<Buffer> {
  return renderToBuffer(<CvDocument data={data} pageSize={pageSize} title={title} />);
}
