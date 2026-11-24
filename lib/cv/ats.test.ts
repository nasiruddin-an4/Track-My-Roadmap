import assert from "node:assert/strict";
import { test } from "node:test";
import { guardNumbers, hasKeyword, normalize, scoreCv, startsWithVerb, type JobKeyword } from "./ats.ts";
import { emptyCv, type CvData } from "./schema.ts";

const kw = (term: string, importance: JobKeyword["importance"] = "required", synonyms: string[] = []): JobKeyword => ({ term, importance, synonyms });

function strongCv(): CvData {
  const d = emptyCv({ name: "Jane Doe", email: "jane@example.com" });
  d.basics.summary = "Frontend developer building React and TypeScript apps.";
  d.skills = [{ name: "Languages", keywords: ["TypeScript", "JavaScript", "Node.js"] }, { name: "Tools", keywords: ["React", "PostgreSQL", "Docker"] }];
  d.work = [{ name: "Acme", position: "Developer", startDate: "2022-03", endDate: "", highlights: [
    "Built a React dashboard used by 1,200 staff", "Cut API response time by 40% with caching", "Led a team of 3 developers"] }];
  return d;
}

test("keywords match whole words, any case, common spellings", () => {
  const cv = normalize("Built APIs in Node.js and Postgres; deployed on K8s. Worked at Google.");
  assert.ok(hasKeyword(cv, kw("node.js")));
  assert.ok(hasKeyword(cv, kw("NodeJS")));
  assert.ok(hasKeyword(cv, kw("PostgreSQL")));
  assert.ok(hasKeyword(cv, kw("Kubernetes")));
  assert.ok(hasKeyword(cv, kw("API"))); // "APIs" counts for "API"
  assert.equal(hasKeyword(cv, kw("REST API")), false); // but nothing says REST
  assert.equal(hasKeyword(cv, kw("Go")), false); // not found inside "Google"
  assert.equal(hasKeyword(cv, kw("Java")), false);
  assert.ok(hasKeyword(normalize("Strong C++ and C# skills, .NET"), kw("C++")));
  assert.ok(hasKeyword(normalize("Strong C++ and C# skills, .NET"), kw("dotnet")));
  assert.ok(hasKeyword(normalize("Experience with GraphQL"), kw("Graph QL", "preferred", ["GraphQL"]))); // the AI's synonyms count
});

test("action verbs", () => {
  for (const b of ["Built a dashboard", "led the team", "Optimised queries", "Spearheaded migration", "Refactored the API"]) assert.ok(startsWithVerb(b), b);
  for (const b of ["Responsible for the API", "Experienced in React", "Team player", "The dashboard"]) assert.equal(startsWithVerb(b), false, b);
});

test("a strong, matching CV scores high and lists what matched", () => {
  const r = scoreCv(strongCv(), [kw("React"), kw("TypeScript"), kw("Docker", "preferred")]);
  assert.equal(r.parts.keywords, 1);
  assert.equal(r.parts.structure, 1);
  assert.ok(r.score >= 90, String(r.score));
  assert.deepEqual(r.missing, []);
});

test("missing required keywords cost twice as much as preferred ones", () => {
  const d = strongCv();
  const missReq = scoreCv(d, [kw("React"), kw("Kubernetes"), kw("Docker", "preferred")]);
  const missPref = scoreCv(d, [kw("React"), kw("Docker"), kw("Kubernetes", "preferred")]);
  assert.ok(missReq.score < missPref.score);
  assert.deepEqual(missReq.missing.map((k) => k.term), ["Kubernetes"]);
  assert.equal(missReq.suggestions[0].section, "skills");
  assert.equal(missReq.suggestions[0].level, "high");
});

test("structure problems are found and linked to their section", () => {
  const d = strongCv();
  d.basics.email = "";
  d.work.push({ name: "", position: "Intern", startDate: "", highlights: ["x".repeat(250)] });
  const r = scoreCv(d, [kw("React")]);
  const failed = r.checks.filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(failed.sort(), ["bullets", "complete", "dates", "email"]);
  assert.ok(r.suggestions.some((s) => s.section === "basics" && /email/.test(s.message)));
  assert.ok(r.suggestions.some((s) => s.section === "work" && /two lines/.test(s.message)));
});

test("an empty CV scores low but never below 0, and gets clear next steps", () => {
  const r = scoreCv(emptyCv(), [kw("React"), kw("SQL")]);
  assert.ok(r.score >= 0 && r.score < 10, String(r.score));
  assert.ok(r.suggestions.length >= 4);
  assert.equal(scoreCv(strongCv(), []).parts.keywords, 0); // no keywords read: no keyword points
});

test("wording: verbs and numbers both count", () => {
  const d = strongCv();
  const good = scoreCv(d, [kw("React")]).parts.wording;
  d.work[0].highlights = ["Responsible for the dashboard", "Worked on caching", "Part of a team"];
  const weak = scoreCv(d, [kw("React")]).parts.wording;
  assert.ok(good > 0.9 && weak < 0.2, `${good} ${weak}`);
});

test("rewrites can't invent numbers: new ones become [X] placeholders", () => {
  assert.equal(guardNumbers("Made the site faster", "Cut page load time by 40% for 2,000 users"), "Cut page load time by [X%] for [X] users");
  assert.equal(guardNumbers("Served 1,200 staff in 2023", "Built a dashboard serving 1,200 staff since 2023."), "Built a dashboard serving 1,200 staff since 2023.");
  assert.equal(guardNumbers("Reduced costs", "Reduced costs by [X%]"), "Reduced costs by [X%]");
  assert.equal(guardNumbers("Led 3 devs", "Led a team of 3 developers across 2 time zones"), "Led a team of 3 developers across [X] time zones");
});
