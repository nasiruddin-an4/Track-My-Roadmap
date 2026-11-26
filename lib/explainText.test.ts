import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanExplanation, explainPrompt } from "./explainText.ts";
import { buildRoadmap, topicInfo, type RoadmapDef } from "./roadmap.ts";

const def: RoadmapDef = {
  slug: "react", title: "React", tagline: "", category: "Skill", level: "Beginner", localKey: "react",
  phases: [{ id: "p1", title: "Components", short: "Components", description: "", items: [["Core ideas", ["Props", "State", "Hooks^"]], ["JSX"]] }],
};
const rm = buildRoadmap(def);

test("topics are looked up from the roadmap, with where they sit", () => {
  assert.deepEqual(topicInfo(rm, "p1/core-ideas/props"), { topic: "Props", card: "Core ideas", phase: "Components", tag: "do" });
  assert.deepEqual(topicInfo(rm, "p1/jsx"), { topic: "JSX", card: null, phase: "Components", tag: "do" }, "a Key concepts topic has no section name");
  assert.equal(topicInfo(rm, "p1/core-ideas/redux"), null);
  assert.equal(topicInfo(rm, "@phase/p1"), null);
});

test("the prompt names the roadmap, phase, section and topic", () => {
  assert.equal(explainPrompt({ roadmap: "React", phase: "Components", card: "Core ideas", topic: "Props" }),
    "Roadmap: React\nPhase: Components\nSection: Core ideas\nTopic: Props");
  assert.equal(explainPrompt({ roadmap: "React", phase: "Components", card: null, topic: "JSX" }), "Roadmap: React\nPhase: Components\nTopic: JSX");
});

test("answers become plain sentences", () => {
  assert.equal(cleanExplanation("**Props** are inputs to a `component`.\n\n- They flow down."), "Props are inputs to a component. They flow down.");
  assert.equal(cleanExplanation("## Props\nSee [the docs](https://react.dev). Use *props* to pass data."), "Props See the docs. Use props to pass data.");
  assert.equal(cleanExplanation("A snake_case_name stays."), "A snake_case_name stays.");
  assert.equal(cleanExplanation("   "), "");
});

test("long answers are cut at a sentence end", () => {
  const long = "First sentence here. ".repeat(60);
  const out = cleanExplanation(long, 100);
  assert.ok(out.length <= 100);
  assert.ok(out.endsWith("."));
});
