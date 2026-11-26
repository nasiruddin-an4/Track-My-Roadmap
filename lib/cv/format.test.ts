import assert from "node:assert/strict";
import { test } from "node:test";
import { bulletsOf, cleanBullet, contactParts, cvFileName, dateRange, fmtDate, layoutCv, layoutText, skillLine, visibleSections } from "./format.ts";
import { emptyCv } from "./schema.ts";

test("dates read as MMM YYYY", () => {
  assert.equal(fmtDate("2023-05"), "May 2023");
  assert.equal(fmtDate("2023-05-17"), "May 2023");
  assert.equal(fmtDate("2023"), "2023");
  assert.equal(fmtDate(""), "");
  assert.equal(fmtDate(undefined), "");
});

test("date ranges use one format and Present for ongoing work", () => {
  assert.equal(dateRange("2023-05", "2024-06"), "May 2023 – Jun 2024");
  assert.equal(dateRange("2023-05", "", true), "May 2023 – Present");
  assert.equal(dateRange("2023-05", ""), "May 2023");
  assert.equal(dateRange("", "", true), "");
  assert.equal(dateRange("", "2024"), "2024");
});

test("bullet characters people paste in are removed (the template adds its own)", () => {
  assert.equal(cleanBullet("• Built it"), "Built it");
  assert.equal(cleanBullet("- Built it"), "Built it");
  assert.equal(cleanBullet("  * • Built it "), "Built it");
  assert.equal(cleanBullet("Built a C-compiler"), "Built a C-compiler");
  assert.deepEqual(bulletsOf(["• one", "", "  ", "two"]), ["one", "two"]);
});

test("contact line: email, phone, place, site, profiles; blanks skipped", () => {
  assert.deepEqual(contactParts({ name: "J", email: "j@x.com", phone: " ", location: { city: "Dhaka", country: "Bangladesh" }, url: "j.dev",
    profiles: [{ network: "GitHub", url: "github.com/j" }] }), ["j@x.com", "Dhaka, Bangladesh", "j.dev", "github.com/j"]);
  assert.deepEqual(contactParts({ name: "J", email: "" }), []);
});

test("empty sections are left out; the person's order is kept", () => {
  const cv = emptyCv({ name: "J" });
  assert.deepEqual(visibleSections(cv), []);
  cv.basics.summary = "Hi";
  cv.skills = [{ name: "", keywords: ["Go"] }];
  cv.work = [{ name: "", position: "", startDate: "", highlights: [] }]; // an untouched blank entry
  cv.sectionOrder = ["skills", "work", "summary", "projects", "education", "certificates", "languages"];
  assert.deepEqual(visibleSections(cv), ["skills", "summary"]);
});

test("skill lines", () => {
  assert.equal(skillLine({ name: "Languages", keywords: ["Go", " ", "Rust"] }), "Languages: Go, Rust");
  assert.equal(skillLine({ name: "", keywords: ["Go"] }), "Go");
  assert.equal(skillLine({ name: "Tools", keywords: [] }), "Tools");
});

test("file names are safe for a download header", () => {
  assert.equal(cvFileName("Jane Doe"), "Jane-Doe-CV.pdf");
  assert.equal(cvFileName("José  Núñez"), "Jose-Nunez-CV.pdf");
  assert.equal(cvFileName('a"b/c\\d'), "abcd-CV.pdf");
  assert.equal(cvFileName(""), "My-CV.pdf");
});

test("the shared layout: the person's order, empty parts left out, one line per thing in reading order", () => {
  const cv = emptyCv({ name: "Jane Doe", email: "jane@x.com" });
  cv.basics.label = "Developer";
  cv.work = [{ name: "Acme", position: "Dev", location: "Dhaka", startDate: "2024-03", endDate: "", highlights: ["• Built it", ""] }];
  cv.education = [{ institution: "DIU", studyType: "BSc", area: "CSE", startDate: "2020", endDate: "2024", score: "3.6" }];
  cv.certificates = [{ name: "Git Roadmap", issuer: "Track My Roadmap", date: "2025-06" }];
  cv.sectionOrder = ["education", "work", "summary", "skills", "projects", "certificates", "languages"];
  const l = layoutCv(cv);
  assert.deepEqual(l.sections.map((s) => s.key), ["education", "work", "certificates"]);
  assert.equal(layoutText(l), [
    "Jane Doe", "Developer", "jane@x.com",
    "EDUCATION", "BSc, CSE — DIU", "2020 – 2024 | Result: 3.6",
    "EXPERIENCE", "Dev — Acme, Dhaka", "Mar 2024 – Present", "• Built it",
    "CERTIFICATES", "Git Roadmap — Track My Roadmap, Jun 2025",
  ].join("\n"));
  assert.deepEqual(layoutCv(emptyCv()).sections, []);
});

test("Bengali CVs: section names, months, digits and 'Present' in Bengali; what the person typed is left alone", () => {
  const d = emptyCv({ name: "নাসির উদ্দিন" });
  d.locale = "bn";
  d.work = [{ name: "টেলিটক", position: "জুনিয়র ডেভেলপার", startDate: "2023-01", highlights: ["React দিয়ে ড্যাশবোর্ড তৈরি"] }];
  d.education = [{ institution: "ঢাকা বিশ্ববিদ্যালয়", studyType: "বিএসসি", startDate: "2018", endDate: "2022-06", score: "CGPA 3.6" }];
  const l = layoutCv(d);
  assert.equal(l.locale, "bn");
  const work = l.sections.find((s) => s.key === "work")!;
  assert.equal(work.title, "কর্ম অভিজ্ঞতা");
  assert.equal(work.kind === "entries" && work.entries[0].meta, "জানুয়ারি ২০২৩ – বর্তমান");
  const edu = l.sections.find((s) => s.key === "education")!;
  assert.equal(edu.title, "শিক্ষাগত যোগ্যতা");
  assert.equal(edu.kind === "entries" && edu.entries[0].meta, "২০১৮ – জুন ২০২২ | ফলাফল: CGPA 3.6");
  assert.equal(fmtDate("2024-12", "bn"), "ডিসেম্বর ২০২৪");
  // English stays the default
  assert.equal(layoutCv(emptyCv()).locale, "en");
  assert.equal(dateRange("2023-01", undefined, true), "Jan 2023 – Present");
});
