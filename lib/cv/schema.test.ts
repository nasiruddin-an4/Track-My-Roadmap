import assert from "node:assert/strict";
import { test } from "node:test";
import { cvPatchSchema, emptyCv, parseCvData, readCvData, SECTION_KEYS } from "./schema.ts";

const valid = () => ({
  ...emptyCv({ name: "Jane Doe", email: "jane@example.com" }),
  work: [{ name: "Acme", position: "Developer", startDate: "2023-05", endDate: "", highlights: ["Built the thing"] }],
  skills: [{ name: "Languages", keywords: ["TypeScript", "Python"], source: "user" as const }],
});

test("a blank CV is valid and lists every section once", () => {
  const r = parseCvData(emptyCv());
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data.sectionOrder, [...SECTION_KEYS]);
});

test("a filled CV passes and text is trimmed", () => {
  const cv = valid();
  cv.basics.name = "  Jane Doe  ";
  const r = parseCvData(cv);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.basics.name, "Jane Doe");
});

test("a bad email is refused, an empty one is allowed", () => {
  const bad = valid(); bad.basics.email = "not-an-email";
  const r = parseCvData(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /basics\.email/);
  const empty = valid(); empty.basics.email = "";
  assert.ok(parseCvData(empty).ok);
});

test("dates must be YYYY or YYYY-MM", () => {
  for (const ok of ["", "2024", "2024-01", "2024-12", "2024-02-29"]) {
    const cv = valid(); cv.work[0].startDate = ok;
    assert.ok(parseCvData(cv).ok, ok);
  }
  for (const bad of ["May 2024", "2024-13", "24-05", "2024/05"]) {
    const cv = valid(); cv.work[0].startDate = bad;
    assert.equal(parseCvData(cv).ok, false, bad);
  }
});

test("section order: duplicates dropped, missing sections added at the end", () => {
  const cv = { ...valid(), sectionOrder: ["work", "work", "skills"] };
  const r = parseCvData(cv);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.data.sectionOrder.slice(0, 2), ["work", "skills"]);
    assert.equal(r.data.sectionOrder.length, SECTION_KEYS.length);
    assert.equal(new Set(r.data.sectionOrder).size, SECTION_KEYS.length);
  }
});

test("unknown sections, unknown sources and oversized lists are refused", () => {
  assert.equal(parseCvData({ ...valid(), sectionOrder: ["hobbies"] }).ok, false);
  const src = valid(); (src.skills[0] as { source: string }).source = "ai";
  assert.equal(parseCvData(src).ok, false);
  const many = valid(); many.work[0].highlights = Array.from({ length: 16 }, () => "x");
  assert.equal(parseCvData(many).ok, false);
  const long = valid(); long.basics.summary = "x".repeat(1501);
  assert.equal(parseCvData(long).ok, false);
});

test("missing required parts are refused", () => {
  assert.equal(parseCvData(null).ok, false);
  assert.equal(parseCvData({ basics: { name: "x", email: "" } }).ok, false);
});

test("readCvData falls back to a blank CV for broken rows", () => {
  assert.deepEqual(readCvData({ nonsense: true }), emptyCv());
  assert.equal(readCvData(valid()).basics.name, "Jane Doe");
});

test("a patch must change something, and titles can't be blank", () => {
  assert.equal(cvPatchSchema.safeParse({}).success, false);
  assert.equal(cvPatchSchema.safeParse({ title: "   " }).success, false);
  assert.ok(cvPatchSchema.safeParse({ title: "Frontend CV" }).success);
  assert.ok(cvPatchSchema.safeParse({ pageSize: "letter" }).success);
  assert.equal(cvPatchSchema.safeParse({ pageSize: "a3" }).success, false);
});
