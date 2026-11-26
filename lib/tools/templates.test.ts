import assert from "node:assert/strict";
import { test } from "node:test";
import { blocksToText, bnDigits, daysBetween, getTemplate, initialValues, longDate, TEMPLATES } from "./templates.ts";

const text = (slug: string, v: Record<string, string>, lang: "en" | "bn") => blocksToText(getTemplate(slug).render(v, lang));

test("dates and day counts", () => {
  assert.equal(longDate("2026-11-26", "en"), "26 November 2026");
  assert.equal(longDate("2026-11-26", "bn"), "২৬ নভেম্বর ২০২৬");
  assert.equal(longDate("", "en"), "");
  assert.equal(daysBetween("2026-11-26", "2026-11-28"), 3);
  assert.equal(daysBetween("2026-11-26", "2026-11-26"), 1);
  assert.equal(daysBetween("2026-11-28", "2026-11-26"), null);
  assert.equal(daysBetween("", "2026-11-26"), null);
  assert.equal(bnDigits("Roll 12"), "Roll ১২");
});

test("every template renders in each of its languages, empty or filled, with no 'undefined'", () => {
  for (const t of TEMPLATES) {
    for (const lang of t.langs) {
      const empty = blocksToText(t.render(initialValues(t, "2026-11-26"), lang));
      assert.ok(empty.length > 80, `${t.slug} ${lang} renders something`);
      assert.ok(!/undefined|null|NaN/.test(empty), `${t.slug} ${lang} empty: ${empty}`);
      assert.match(empty, /\[[^\]]+\]/, `${t.slug} ${lang} shows [hints] for what's missing`);
    }
  }
});

test("leave application in English", () => {
  const out = text("leave-application", {
    kind: "school", institution: "Motijheel Govt. Boys’ High School", place: "Motijheel, Dhaka", when: "past",
    from: "2026-11-23", to: "2026-11-25", reason: "sick", name: "Rahim Uddin", class: "Nine", section: "B", roll: "12", date: "2026-11-26",
  }, "en");
  assert.match(out, /^Date: 26 November 2026/);
  assert.match(out, /To\nThe Headmaster\nMotijheel Govt\. Boys’ High School\nMotijheel, Dhaka/);
  assert.match(out, /Subject: Application for leave of absence for 3 days\./);
  assert.match(out, /I could not attend school from 23 November 2026 to 25 November 2026 \(3 days\) because I was ill with a fever\./);
  assert.match(out, /Class: Nine, Section: B\nRoll: 12$/);
  assert.ok(!out.includes("["), "nothing left to fill in");
});

test("leave application in Bengali: digits, college wording, future leave, a girl student", () => {
  const out = text("leave-application", {
    kind: "college", institution: "ঢাকা কলেজ", when: "future", from: "2026-12-01", to: "2026-12-02", reason: "other",
    reasonText: "দাদির গুরুতর অসুস্থতার", name: "সুমাইয়া আক্তার", gender: "girl", class: "একাদশ", roll: "৭", date: "2026-11-26",
  }, "bn");
  assert.match(out, /^তারিখ: ২৬ নভেম্বর ২০২৬/);
  assert.match(out, /বরাবর\nঅধ্যক্ষ\nঢাকা কলেজ/);
  assert.match(out, /বিষয়: ২ দিনের ছুটির জন্য আবেদন।/);
  assert.match(out, /আমি আপনার কলেজের একাদশ শ্রেণির একজন নিয়মিত ছাত্রী।/);
  assert.match(out, /দাদির গুরুতর অসুস্থতার কারণে আমি আগামী ১ ডিসেম্বর ২০২৬ থেকে ২ ডিসেম্বর ২০২৬ পর্যন্ত মোট ২ দিন কলেজে উপস্থিত থাকতে পারব না।/);
  assert.match(out, /আপনার একান্ত অনুগত ছাত্রী/);
});

test("testimonial and TC applications ask for the right things", () => {
  const t = text("testimonial-application", { doc: "testimonial", exam: "SSC", year: "2026", result: "GPA 5.00", roll: "123456", reg: "1234567890", purpose: "college admission", name: "Rahim" }, "en");
  assert.match(t, /Subject: Application for a testimonial\./);
  assert.match(t, /passed the SSC examination in 2026 from your school with GPA 5\.00/);
  assert.match(t, /I now need a testimonial for college admission\./);
  assert.ok(!/Class:/.test(t), "a former student has no class line");
  const tc = text("testimonial-application", { doc: "tc", class: "Eight", roll: "4", why: "my father has been transferred to Chattogram", name: "Rahim" }, "en");
  assert.match(tc, /Subject: Application for a transfer certificate\./);
  assert.match(tc, /I have to leave this school because my father has been transferred to Chattogram\./);
});

test("cover letter turns lines into bullet points", () => {
  const out = text("cover-letter", { name: "Nasir", company: "bKash", job: "Junior Engineer", strengths: "- Built an app\n\n• Knows SQL", date: "2026-11-26" }, "en");
  assert.match(out, /Dear Hiring Manager,/);
  assert.match(out, /apply for the Junior Engineer position at bKash\./);
  assert.match(out, /• Built an app\n• Knows SQL/);
});

test("remembered details fill shared fields only", () => {
  const t = getTemplate("leave-application");
  const v = initialValues(t, "2026-11-26", { name: "Rahim", roll: "12", from: "2020-01-01" });
  assert.equal(v.name, "Rahim");
  assert.equal(v.roll, "12");
  assert.equal(v.from, "", "dates aren't remembered");
  assert.equal(v.date, "2026-11-26");
  assert.equal(v.kind, "school");
});
