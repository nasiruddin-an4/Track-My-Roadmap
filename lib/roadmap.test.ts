import assert from "node:assert/strict";
import { test } from "node:test";
import { roadmapStat, type CatalogEntry } from "./progressStats.ts";
import { buildRoadmap, computeProgress, phaseMark, progressUnitsByPhase, type RoadmapDef } from "./roadmap.ts";

const def: RoadmapDef = {
  slug: "demo", title: "Demo", tagline: "", category: "Skill", level: "Beginner", localKey: "demo",
  phases: [
    { id: "p1", title: "Basics", short: "Basics", description: "", items: [["Loops"], ["Functions"], ["Extras?"]] },
    { id: "p2", title: "Arrays", short: "Arrays", description: "", items: [["Arrays"], ["Sorting"]] },
    { id: "habits", title: "Habits", short: "Habits", description: "", ongoing: true, items: [["Read docs~"]] },
  ],
};
const rm = buildRoadmap(def);
const catalog: CatalogEntry = {
  slug: def.slug, title: def.title, category: def.category, localKey: def.localKey,
  phases: rm.numbered.map((ph, i) => ({ id: ph.id, title: ph.title, units: progressUnitsByPhase(rm)[i] })),
};

test("a phase is complete when every required topic is ticked", () => {
  const p = computeProgress(rm, new Set(["p1/loops", "p1/functions"]), false);
  assert.equal(p.full.p1, true);
  assert.equal(p.marked.p1, false);
  assert.equal(p.current?.id, "p2");
  assert.equal(p.complete, false);
});

test("marking a phase complete finishes it without ticking its other topics", () => {
  const done = new Set(["p1/loops", phaseMark("p1")]);
  const p = computeProgress(rm, done, false);
  assert.equal(p.full.p1, true, "the phase is complete");
  assert.equal(p.marked.p1, true);
  assert.equal(p.status(rm.byId.p1), "done");
  assert.equal(p.current?.id, "p2", "the next phase is where you are now");
  assert.deepEqual(p.tallies.p1, { d: 1, t: 2 }, "only the topic actually ticked counts");
  assert.equal(p.done, 1);
  assert.equal(done.has("p1/functions"), false, "unticked topics stay unticked");
  assert.equal(p.next?.key, "p2/arrays");
});

test("every phase marked complete: the roadmap is complete, topic counts stay honest", () => {
  const p = computeProgress(rm, new Set([phaseMark("p1"), phaseMark("p2")]), false);
  assert.equal(p.complete, true);
  assert.equal(p.current, null);
  assert.equal(p.phasesDone, 2);
  assert.equal(p.done, 0);
});

test("the mark is never mistaken for a topic, and reopening undoes it", () => {
  const p = computeProgress(rm, new Set(["p1/loops"]), false);
  assert.equal(p.full.p1, false);
  assert.equal(p.current?.id, "p1");
  assert.ok(!rm.phases.some((ph) => ph.cards.some((c) => c.rows.some((r) => r.key.startsWith("@")))));
});

test("profile and Road Card summaries agree with the tracker", () => {
  const ticked = ["p1/loops", phaseMark("p1")];
  const s = roadmapStat(catalog, ticked, 1);
  assert.equal(s.phasesDone, 1);
  assert.equal(s.phaseStates, "du");
  assert.deepEqual(s.current, { num: 2, title: "Arrays" });
  assert.equal(s.done, 1);
  assert.equal(s.pct, 25, "1 of 4 required topics");
  assert.equal(s.complete, false);
  const all = roadmapStat(catalog, [phaseMark("p1"), phaseMark("p2")], 1);
  assert.equal(all.complete, true);
  assert.equal(all.current, null);
  assert.equal(all.pct, 0);
  const ticks = roadmapStat(catalog, ["p1/loops", "p1/functions", "p2/arrays", "p2/sorting"], 1);
  assert.equal(ticks.complete, true);
  assert.equal(ticks.pct, 100);
});
