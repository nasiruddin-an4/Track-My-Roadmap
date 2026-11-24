import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSuggestions, skillName, type TopicSource } from "./autofill.ts";

const fe: TopicSource = {
  slug: "frontend", title: "Frontend Developer", category: "Career path",
  phases: [
    { title: "Basics", topics: [{ key: "p1/html", name: "HTML" }, { key: "p1/css", name: "CSS" }, { key: "p1/q", name: "What is HTTP?" }] },
    { title: "React", topics: [{ key: "p2/react", name: "Learn the basics of React" }, { key: "p2/hooks", name: "Hooks" }, { key: "p2/build", name: "Build a project" }] },
    { title: "Testing", topics: [{ key: "p3/jest", name: "Jest" }] },
  ],
};
const go: TopicSource = { slug: "go", title: "Go", category: "Skill", phases: [{ title: "Go basics", topics: [{ key: "g/css", name: "CSS" }, { key: "g/go", name: "Goroutines" }] }] };

test("skill names: questions, tasks and long phrases are left out", () => {
  assert.equal(skillName("Learn the basics of React"), "React");
  assert.equal(skillName("What is HTTP?"), null);
  assert.equal(skillName("Build a project"), null);
  assert.equal(skillName("Namespaces, cgroups, chroot and UnionFS in container runtimes"), null);
  assert.equal(skillName("Tailwind CSS"), "Tailwind CSS");
});

test("only ticked topics become skills, grouped by phase", () => {
  const s = buildSuggestions([fe], { frontend: { done: ["p1/html", "p1/q", "p2/react", "p2/hooks", "p2/build"] } }, []);
  assert.deepEqual(s.skills.map((g) => [g.group, g.keywords]), [["Basics", ["HTML"]], ["React", ["React", "Hooks"]]]);
  assert.ok(s.skills.every((g) => g.roadmap === "Frontend Developer"));
});

test("a skill learned in two roadmaps is offered once, from the roadmap with most progress", () => {
  const s = buildSuggestions([go, fe], { frontend: { done: ["p1/html", "p1/css", "p3/jest"] }, go: { done: ["g/css", "g/go"] } }, []);
  assert.deepEqual(s.skills.map((g) => g.keywords), [["HTML", "CSS"], ["Jest"], ["Goroutines"]]);
});

test("headline: from the main career roadmap; 'Aspiring' until it's finished", () => {
  assert.equal(buildSuggestions([fe], { frontend: { done: ["p1/html"] } }, []).label, "Aspiring Frontend Developer");
  assert.equal(buildSuggestions([fe], { frontend: { done: ["p1/html"] } }, [{ slug: "frontend", title: "Frontend Developer", when: 0 }]).label, "Frontend Developer");
  assert.equal(buildSuggestions([go], { go: { done: ["g/go"] } }, []).label, null); // a skill roadmap isn't a job title
});

test("completed roadmaps become certificates", () => {
  const when = Date.UTC(2025, 5, 14);
  const s = buildSuggestions([], {}, [{ slug: "frontend", title: "Frontend Developer", when }]);
  assert.deepEqual(s.certificates, [{ id: "frontend", name: "Frontend Developer Roadmap", issuer: "Track My Roadmap", date: "2025-06" }]);
});

test("nothing started, nothing suggested", () => {
  assert.deepEqual(buildSuggestions([fe, go], {}, []), { label: null, skills: [], certificates: [] });
});
