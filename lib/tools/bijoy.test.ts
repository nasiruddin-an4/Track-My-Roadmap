import assert from "node:assert/strict";
import { test } from "node:test";
import { bijoyToUnicode, looksLikeUnicodeBengali, unicodeToBijoy } from "./bijoy.ts";

// [Bijoy as typed in SutonnyMJ, Unicode]
const PAIRS: [string, string][] = [
  ["Avgvi †mvbvi evsjv", "আমার সোনার বাংলা"],
  ["evsjv‡`k", "বাংলাদেশ"],
  ["MÖvg", "গ্রাম"],
  ["cÖ_g", "প্রথম"],
  ["Kg©", "কর্ম"],
  ["ag©xq", "ধর্মীয়"],
  ["KxwZ©", "কীর্তি"],
  ["Kvh©", "কার্য"],
  ["c~e©", "পূর্ব"],
  ["mvwU©wd‡KU", "সার্টিফিকেট"],
  ["‡KŠkj", "কৌশল"],
  ["‡QvU", "ছোট"],
  ["‰ekvL", "বৈশাখ"],
  ["e¨vsK", "ব্যাংক"],
  ["we`¨vjq", "বিদ্যালয়"],
  ["wek¦we`¨vjq", "বিশ্ববিদ্যালয়"],
  ["e¨w³", "ব্যক্তি"],
  ["AšÍi", "অন্তর"],
  ["gš¿x", "মন্ত্রী"],
  ["my›`i", "সুন্দর"],
  ["j²x", "লক্ষ্মী"],
  ["†cÖm", "প্রেস"],
  ["w¯’i", "স্থির"],
  ["Pvu`", "চাঁদ"],
  ["QvÎx", "ছাত্রী"],
  ["D”P", "উচ্চ"],
  ["cixÿv", "পরীক্ষা"],
  ["wk¶v", "শিক্ষা"],
  ["i¨vev", "র‍্যাবা"],
  ["evOvwj", "বাঙালি"],
  ["iæwU", "রুটি"],
  ["ch©šÍ", "পর্যন্ত"],
  ["2026 mv‡j", "২০২৬ সালে"],
  ["Avwg fv‡jv AvwQ|", "আমি ভালো আছি।"],
];

test("Bijoy text becomes Unicode in reading order", () => {
  for (const [bijoy, unicode] of PAIRS) assert.equal(bijoyToUnicode(bijoy), unicode.normalize("NFC"), bijoy);
});

test("Unicode converts to Bijoy and back to the same text", () => {
  for (const [, unicode] of PAIRS) assert.equal(bijoyToUnicode(unicodeToBijoy(unicode)), unicode.normalize("NFC"), unicode);
});

test("Unicode → Bijoy uses the usual glyphs", () => {
  assert.equal(unicodeToBijoy("আমার সোনার বাংলা"), "Avgvi †mvbvi evsjv");
  assert.equal(unicodeToBijoy("বাংলাদেশ"), "evsjv‡`k");
  assert.equal(unicodeToBijoy("প্রথম"), "cÖ_g");
  assert.equal(unicodeToBijoy("কর্ম"), "Kg©");
  assert.equal(unicodeToBijoy("কীর্তি"), "KxwZ©");
  assert.equal(unicodeToBijoy("কৌশল"), "†KŠkj"); // e-kar's wider shape at the start of a word
  assert.equal(unicodeToBijoy("সম্মেলন"), "m‡¤§jb"); // the usual one inside a word, before the whole ম্ম cluster
  assert.equal(unicodeToBijoy("রুটি"), "iæwU");
});

test("alternative glyph shapes all mean the same letter", () => {
  assert.equal(bijoyToUnicode("Kz"), bijoyToUnicode("Ky")); // u-kar
  assert.equal(bijoyToUnicode("KÖ"), bijoyToUnicode("Kª")); // ra-phala
  assert.equal(bijoyToUnicode("šÍ"), bijoyToUnicode("š—")); // ন্ত
  assert.equal(bijoyToUnicode("ÿ"), bijoyToUnicode("¶")); // ক্ষ
});

test("output is NFC, the standard form on the web", () => {
  const out = bijoyToUnicode("cov bq");
  assert.equal(out, out.normalize("NFC"));
});

test("decomposed and composed spellings give the same Bijoy", () => {
  assert.equal(unicodeToBijoy("পড়া"), unicodeToBijoy("পড়া"));
  assert.equal(unicodeToBijoy("ছোট"), unicodeToBijoy("ছোট"));
  assert.equal(unicodeToBijoy("পড়া"), "cov");
});

test("English text, numbers and line breaks pass through Unicode → Bijoy untouched", () => {
  assert.equal(unicodeToBijoy("CV: Nasir\n"), "CV: Nasir\n");
  assert.equal(unicodeToBijoy(""), "");
  assert.equal(bijoyToUnicode(""), "");
});

test("stray marks don't crash or vanish", () => {
  assert.equal(bijoyToUnicode("w"), "ি");
  assert.equal(bijoyToUnicode("Ö"), "্র");
  assert.equal(bijoyToUnicode("K&"), "ক্‌");
  assert.equal(unicodeToBijoy("ক্‌"), "K&");
});

test("direction guess", () => {
  assert.equal(looksLikeUnicodeBengali("আমার সোনার বাংলা"), true);
  assert.equal(looksLikeUnicodeBengali("Avgvi †mvbvi evsjv"), false);
  assert.equal(looksLikeUnicodeBengali("hello"), false);
});
