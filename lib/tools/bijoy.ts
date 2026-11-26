/*
 * Bijoy (SutonnyMJ) ↔ Unicode Bengali.
 *
 * Bijoy text is ASCII and Latin-1 characters that the SutonnyMJ font draws as Bengali shapes. It stores
 * letters in the order they are drawn, not the order they are read: ি, ে and ৈ come before their consonant,
 * and the reph (র্) comes after it. So converting is two jobs: swap each glyph for its Unicode letters,
 * then put the letters back in reading order (and the reverse for Unicode → Bijoy).
 *
 * Glyph table cross-checked against the MIT-licensed converters bnunicode2ansi and bijoy2unicode.
 * No runtime imports: the unit tests run this file directly.
 */

const HASANTA = "্";
const ZWJ = "‍";
const ZWNJ = "‌";

/** Bijoy glyph → Unicode. Multi-character keys win over single ones (longest match first). */
const B2U: Record<string, string> = {
  // two-character sequences
  "Av": "আ", "i¨": "র‍্য", "„„": "ৃ",
  // vowels
  "A": "অ", "B": "ই", "C": "ঈ", "D": "উ", "E": "ঊ", "F": "ঋ", "G": "এ", "H": "ঐ", "I": "ও", "J": "ঔ",
  // consonants
  "K": "ক", "L": "খ", "M": "গ", "N": "ঘ", "O": "ঙ", "P": "চ", "Q": "ছ", "R": "জ", "S": "ঝ", "T": "ঞ",
  "U": "ট", "V": "ঠ", "W": "ড", "X": "ঢ", "Y": "ণ", "Z": "ত", "_": "থ", "`": "দ", "a": "ধ", "b": "ন",
  "c": "প", "d": "ফ", "e": "ব", "f": "ভ", "g": "ম", "h": "য", "i": "র", "j": "ল", "k": "শ", "l": "ষ",
  "m": "স", "n": "হ", "o": "ড়", "p": "ঢ়", "q": "য়", "r": "ৎ", "s": "ং", "t": "ঃ", "u": "ঁ",
  // digits
  "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  // vowel signs (several glyph shapes each)
  "v": "া", "w": "ি", "x": "ী", "y": "ু", "z": "ু", "“": "ু", "æ": "ু", "–": "ু",
  "~": "ূ", "ƒ": "ূ", "‚": "ূ", "„": "ৃ", "…": "ৃ",
  "†": "ে", "‡": "ে", "ˆ": "ৈ", "‰": "ৈ", "Š": "ৗ",
  // signs and punctuation
  "|": "।", "&": HASANTA + ZWNJ, "©": "র্",
  "Ò": "“", "Ó": "”", "Ô": "‘", "Õ": "’", "Ñ": "–", "Ð": "-",
  // forms joined under or after a consonant (phala and subscript shapes)
  "^": "্ব", "Ÿ": "্ব", "¡": "্ব", "¦": "্ব", "¨": "্য", "ª": "্র", "«": "্র", "Ö": "্র",
  "¬": "্ল", "­": "্ল", "ø": "্ল", "œ": "্ন", "è": "্ণ", "¥": "্ম", "§": "্ম", "¢": "্ভ", "£": "্ভ্র",
  "‹": "্ক", "Œ": "্ক্র", "—": "্ত", "Í": "্ত", "¿": "্ত্র", "‘": "্তু", "’": "্থ", "ú": "্প",
  // half forms that join the next consonant
  "”": "চ্", "•": "ঙ্", "˜": "দ্", "™": "দ্", "š": "ন্", "›": "ন্", "¤": "ম্", "®": "ষ্", "¯": "স্",
  // ready-made conjuncts
  "°": "ক্ক", "±": "ক্ট", "²": "ক্ষ্ম", "³": "ক্ত", "´": "ক্ম", "µ": "ক্র", "¶": "ক্ষ", "ÿ": "ক্ষ", "·": "ক্স",
  "¸": "গু", "º": "গ্দ", "»": "গ্ধ", "¼": "ঙ্ক", "½": "ঙ্গ", "¾": "জ্জ", "À": "জ্ঝ", "Á": "জ্ঞ", "¹": "জ্ঞ",
  "Â": "ঞ্চ", "Ã": "ঞ্ছ", "Ä": "ঞ্জ", "Å": "ঞ্ঝ", "Æ": "ট্ট", "Ç": "ড্ড", "È": "ণ্ট", "É": "ণ্ঠ", "Ê": "ণ্ড",
  "Ë": "ত্ত", "Ì": "ত্থ", "Î": "ত্র", "Ï": "দ্দ", "×": "দ্ধ", "Ø": "দ্ব", "Ù": "দ্ম", "Ú": "ন্ঠ", "Û": "ন্ড",
  "Ü": "ন্ধ", "Ý": "ন্স", "Þ": "প্ট", "ß": "প্ত", "à": "প্প", "á": "প্স", "â": "ব্জ", "ã": "ব্দ", "ä": "ব্ধ",
  "å": "ভ্র", "ç": "ম্ফ", "é": "ল্ক", "ê": "ল্গ", "ë": "ল্ট", "ì": "ল্ড", "í": "ল্প", "î": "ল্ফ", "ï": "শু",
  "ð": "শ্চ", "ñ": "শ্ছ", "ò": "ষ্ণ", "ó": "ষ্ট", "ô": "ষ্ঠ", "õ": "ষ্ফ", "ö": "স্খ", "÷": "স্ট", "ù": "স্ফ",
  "û": "হু", "ü": "হৃ", "ý": "হ্ন", "þ": "হ্ম",
};

/** Unicode conjuncts (and a few consonant + vowel-sign pairs) that Bijoy draws with a dedicated glyph. */
const CONJUNCTS: Record<string, string> = {
  "র‍্য": "i¨", "্র্য": "ª¨", "ম্প্র": "¤cÖ", "ক্ষ্ম": "²", "স্ক্র": "¯Œ", "ষ্ক্র": "®Œ", "ম্ভ্র": "¤£",
  "ঙ্ক্ষ": "•¶", "চ্ছ্ব": "”Q¡", "জ্জ্ব": "¾¡", "ত্ত্ব": "Ë¡", "ন্ত্ব": "š—¡", "ন্ত্র": "š¿", "স্ত্র": "¯¿", "ন্দ্ব": "›Ø",
  "ক্ক": "°", "ক্ট": "±", "ক্ত": "³", "ক্ব": "K¡", "ক্র": "µ", "ক্ল": "K¬", "ক্ষ": "¶", "ক্স": "·", "ক্ম": "´",
  "গ্দ": "º", "গ্ধ": "»", "গ্ন": "Mœ", "গ্ম": "M¥", "গ্ল": "Mø",
  "ঙ্ক": "¼", "ঙ্খ": "•L", "ঙ্গ": "½", "ঙ্ঘ": "•N",
  "চ্চ": "”P", "চ্ছ": "”Q", "চ্ঞ": "”T",
  "জ্জ": "¾", "জ্ঝ": "À", "জ্ঞ": "Á", "জ্ব": "R¡",
  "ঞ্চ": "Â", "ঞ্ছ": "Ã", "ঞ্জ": "Ä", "ঞ্ঝ": "Å",
  "ট্ট": "Æ", "ট্ব": "U¡", "ট্ম": "U¥", "ড্ড": "Ç",
  "ণ্ট": "È", "ণ্ঠ": "É", "ণ্ড": "Ê", "ণ্ব": "Y^",
  "ত্ত": "Ë", "ত্থ": "Ì", "ত্ন": "Zœ", "ত্ম": "Z¥", "ত্ব": "Z¡", "ত্র": "Î", "থ্ব": "_¡",
  "দ্গ": "˜M", "দ্ঘ": "˜N", "দ্দ": "Ï", "দ্ধ": "×", "দ্ব": "Ø", "দ্ভ": "™¢", "দ্ম": "Ù",
  "ধ্ব": "aŸ", "ধ্ম": "a¥",
  "ন্ট": "›U", "ন্ঠ": "Ú", "ন্ড": "Û", "ন্ত": "šÍ", "ন্থ": "š’", "ন্দ": "›`", "ন্ধ": "Ü", "ন্ন": "bœ", "ন্ব": "š^",
  "ন্ম": "b¥", "ন্স": "Ý",
  "প্ট": "Þ", "প্ত": "ß", "প্ন": "cœ", "প্প": "à", "প্ল": "cø", "প্স": "á", "ফ্ল": "d¬",
  "ব্জ": "â", "ব্দ": "ã", "ব্ধ": "ä", "ব্ব": "eŸ", "ব্ল": "eø", "ভ্র": "å",
  "ম্ন": "gœ", "ম্প": "¤ú", "ম্ফ": "ç", "ম্ব": "¤^", "ম্ভ": "¤¢", "ম্ম": "¤§", "ম্ল": "¤ø",
  "ল্ক": "é", "ল্গ": "ê", "ল্ট": "ë", "ল্ড": "ì", "ল্প": "í", "ল্ফ": "î", "ল্ব": "j¦", "ল্ম": "j¥", "ল্ল": "jø",
  "শ্চ": "ð", "শ্ছ": "ñ", "শ্ন": "kœ", "শ্ব": "k¦", "শ্ম": "k¥", "শ্ল": "kø",
  "ষ্ক": "®‹", "ষ্ট": "ó", "ষ্ঠ": "ô", "ষ্ণ": "ò", "ষ্প": "®ú", "ষ্ফ": "õ", "ষ্ম": "®§",
  "স্ক": "¯‹", "স্খ": "ö", "স্ট": "÷", "স্ত": "¯Í", "স্থ": "¯’", "স্ন": "mœ", "স্প": "¯ú", "স্ফ": "ù", "স্ব": "¯^",
  "স্ম": "¯§", "স্ল": "¯ø",
  "হ্ণ": "nè", "হ্ন": "ý", "হ্ব": "nŸ", "হ্ম": "þ", "হ্ল": "n¬",
};

/** A consonant cluster followed by u/uu/ri-kar that Bijoy draws as one glyph. */
const WITH_KAR: Record<string, string> = {
  "গু": "¸", "শু": "ï", "হু": "û", "হৃ": "ü", "রু": "iæ", "রূ": "iƒ",
  "ন্তু": "š‘", "স্তু": "¯‘", "দ্রু": "`ª“", "ভ্রু": "å“", "গ্রু": "Mªy",
};

/** Unicode letter or sign → its plain Bijoy key (the first, most common glyph). */
const SINGLE: Record<string, string> = {
  "অ": "A", "আ": "Av", "ই": "B", "ঈ": "C", "উ": "D", "ঊ": "E", "ঋ": "F", "এ": "G", "ঐ": "H", "ও": "I", "ঔ": "J",
  "ক": "K", "খ": "L", "গ": "M", "ঘ": "N", "ঙ": "O", "চ": "P", "ছ": "Q", "জ": "R", "ঝ": "S", "ঞ": "T",
  "ট": "U", "ঠ": "V", "ড": "W", "ঢ": "X", "ণ": "Y", "ত": "Z", "থ": "_", "দ": "`", "ধ": "a", "ন": "b",
  "প": "c", "ফ": "d", "ব": "e", "ভ": "f", "ম": "g", "য": "h", "র": "i", "ল": "j", "শ": "k", "ষ": "l",
  "স": "m", "হ": "n", "ড়": "o", "ঢ়": "p", "য়": "q", "ৎ": "r", "ং": "s", "ঃ": "t", "ঁ": "u",
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  "া": "v", "ি": "w", "ী": "x", "ু": "y", "ূ": "~", "ৃ": "…", "ে": "‡", "ৈ": "‰", "ৗ": "Š",
  "।": "|", "॥": "||", "“": "Ò", "”": "Ó", "‘": "Ô", "’": "Õ", "–": "Ñ", "—": "Ñ",
};

/** Joined forms after a consonant: ya-, ra-, ba-, ma-, la- and na-phala. Anything else gets a visible hasanta. */
const PHALA: Record<string, string> = { "য": "¨", "র": "Ö", "ব": "^", "ম": "¥", "ল": "ø", "ন": "œ" };
/** Consonants whose ra-phala uses the other glyph shape. */
const RA_PHALA_ALT = new Set(["দ", "ট", "ঠ", "ড", "ঢ"]);

const CONSONANT = /[ক-হড়ঢ়য়]/;
const KEYS_BY_LENGTH = (table: Record<string, string>) => {
  const max = Math.max(...Object.keys(table).map((k) => k.length));
  return { table, max };
};
const B2U_KEYS = KEYS_BY_LENGTH(B2U);
const CONJUNCT_KEYS = KEYS_BY_LENGTH(CONJUNCTS);

type Kind = "prekar" | "postkar" | "join" | "half" | "cons" | "reph" | "other";
type Token = { key: string; u: string; kind: Kind };

function kindOf(key: string, u: string): Kind {
  if (key === "©") return "reph";
  if (u === "ি" || u === "ে" || u === "ৈ") return "prekar";
  if (/^[াী-ৄৗ]$/.test(u)) return "postkar";
  if (u.startsWith(HASANTA) && u !== HASANTA + ZWNJ) return "join";
  if (CONSONANT.test(u[0])) return u.endsWith(HASANTA) ? "half" : "cons";
  return "other";
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < text.length;) {
    let hit = "";
    for (let len = Math.min(B2U_KEYS.max, text.length - i); len > 0; len--) {
      const k = text.slice(i, i + len);
      if (k in B2U) { hit = k; break; }
    }
    if (hit) { out.push({ key: hit, u: B2U[hit], kind: kindOf(hit, B2U[hit]) }); i += hit.length; }
    else { out.push({ key: text[i], u: text[i], kind: "other" }); i += 1; }
  }
  return out;
}

/** Joins two pieces, so a half form (ন্) meeting a joined form (্ত) shares one hasanta (ন্ত). */
const glue = (a: string, b: string) => (a.endsWith(HASANTA) && b.startsWith(HASANTA) ? a + b.slice(1) : a + b);

/** Reads one consonant cluster (e.g. স + ্ত + ্র) starting at `i`; returns it and the index after it. */
function readCluster(tokens: Token[], i: number): [string, number] {
  let s = "", j = i, needConsonant = true;
  while (j < tokens.length) {
    const t = tokens[j];
    if (needConsonant) {
      if (t.kind === "cons" || t.kind === "half") { s = glue(s, t.u); j++; needConsonant = t.kind === "half"; continue; }
      if (t.kind === "join" && s) { s = glue(s, t.u); j++; needConsonant = false; continue; }
      break;
    }
    if (t.kind === "join") { s = glue(s, t.u); j++; continue; }
    break;
  }
  return [s, j];
}

/** Bijoy (SutonnyMJ) text → Unicode Bengali. */
export function bijoyToUnicode(text: string): string {
  const tokens = tokenize(text);
  let out = "";
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i];
    if (t.kind === "prekar") {
      // ি/ে/ৈ is drawn first but read after its consonant cluster
      let j = i + 1, marks = "";
      while (tokens[j]?.u === "ঁ") { marks += "ঁ"; j++; }
      const [cluster, k0] = readCluster(tokens, j);
      if (!cluster) { out += t.u + marks; i = j; continue; }
      let k = k0, kar = t.u;
      const reph = tokens[k]?.kind === "reph";
      if (reph) k++;
      if (kar === "ে" && tokens[k]?.u === "া") { kar = "ো"; k++; }
      else if (kar === "ে" && tokens[k]?.u === "ৗ") { kar = "ৌ"; k++; }
      out += (reph ? "র্" : "") + cluster + kar + marks;
      i = k;
    } else if (t.kind === "cons" || t.kind === "half" || t.kind === "join") {
      const [cluster, k] = readCluster(tokens, i);
      if (!cluster) { out += t.u; i++; continue; }
      // the reph (©) is drawn after the cluster, sometimes after its vowel sign too, but read before it
      if (tokens[k]?.kind === "reph") { out += "র্" + cluster; i = k + 1; }
      else if (tokens[k]?.kind === "postkar" && tokens[k + 1]?.kind === "reph") { out += "র্" + cluster + tokens[k].u; i = k + 2; }
      else { out += cluster; i = k; }
    } else {
      out += t.u;
      i++;
    }
  }
  return out
    .replace(/অা/g, "আ")
    .replace(/্্/g, HASANTA)
    .replace(/্‌্‌/g, HASANTA + ZWNJ)
    .replace(/ঁ([াী-ৄৗ])/g, "$1ঁ") // Unicode order: vowel sign, then chandrabindu
    .normalize("NFC"); // the web's standard form (ড় ঢ় য় as letter + nukta), so search and copy-paste match other text
}

/** Puts Unicode Bengali into one standard spelling before converting (composed ড় ঢ় য়, ZWJ for র‍্য). */
function normalizeUnicode(text: string): string {
  return text
    .normalize("NFC")
    .replace(/ড়/g, "ড়")
    .replace(/ঢ়/g, "ঢ়")
    .replace(/য়/g, "য়")
    .replace(/র‌্য/g, "র‍্য");
}

function clusterToBijoy(cluster: string): string {
  let out = "";
  for (let i = 0; i < cluster.length;) {
    let hit = "";
    for (let len = Math.min(CONJUNCT_KEYS.max, cluster.length - i); len > 1; len--) {
      const k = cluster.slice(i, i + len);
      if (k in CONJUNCTS) { hit = k; break; }
    }
    if (hit) { out += CONJUNCTS[hit]; i += hit.length; continue; }
    const c = cluster[i];
    if (c === HASANTA) {
      const next = cluster[i + 1];
      const prev = cluster[i - 1];
      if (next && next in PHALA) out += next === "র" && RA_PHALA_ALT.has(prev) ? "ª" : PHALA[next];
      else out += "&" + (next ? SINGLE[next] ?? next : "");
      i += next ? 2 : 1;
      continue;
    }
    if (c !== ZWJ && c !== ZWNJ) out += SINGLE[c] ?? c;
    i++;
  }
  return out;
}

const C = "[\\u0995-\\u09B9\\u09DC\\u09DD\\u09DF]";
// optional reph, a consonant cluster (with joined forms), then an optional vowel sign
const SYLLABLE = new RegExp(`(র্(?=${C}))?(${C}(?:\\u200D?\\u09CD${C})*)([\\u09BE-\\u09CC\\u09D7])?`, "g");
const BENGALI = /[ঀ-৿]/;

/** Unicode Bengali → Bijoy (SutonnyMJ) text. Characters that aren't Bengali are left as they are. */
export function unicodeToBijoy(text: string): string {
  const src = normalizeUnicode(text);
  let out = "", last = 0;
  for (const m of src.matchAll(SYLLABLE)) {
    const at = m.index ?? 0;
    out += singles(src.slice(last, at));
    last = at + m[0].length;
    const [, reph, cluster, kar] = m;
    const r = reph ? "©" : "";
    const wordStart = at === 0 || !BENGALI.test(src[at - 1]);
    const e = wordStart ? "†" : "‡"; // e-kar has a wider shape at the start of a word
    if (kar && cluster + kar in WITH_KAR) { out += WITH_KAR[cluster + kar] + r; continue; }
    const body = clusterToBijoy(cluster);
    if (!kar) out += body + r;
    else if (kar === "ি") out += "w" + body + r;
    else if (kar === "ে") out += e + body + r;
    else if (kar === "ৈ") out += "‰" + body + r;
    else if (kar === "ো") out += e + body + r + "v";
    else if (kar === "ৌ") out += e + body + r + "Š";
    else out += body + r + (SINGLE[kar] ?? kar);
  }
  return out + singles(src.slice(last));
}

function singles(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === HASANTA) { out += "&"; if (s[i + 1] === ZWNJ) i++; continue; }
    if (c === ZWJ || c === ZWNJ) continue;
    out += SINGLE[c] ?? c;
  }
  return out;
}

/** A rough guess at which way to convert: Bengali letters mean Unicode; Bijoy's Latin-1 glyphs or letter soup mean Bijoy. */
export function looksLikeUnicodeBengali(text: string): boolean {
  const bn = (text.match(/[ঀ-৿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z -ÿ–-›]/g) ?? []).length;
  return bn > 0 && bn >= latin;
}
