/*
 * Roadmap data model.
 *
 * A roadmap is stored as compact JSON (content/roadmaps/data/*.json). Each phase has items:
 * [name] or [name, [children]]. A name may end in markers:
 *   ?  optional      ~  continuous (ongoing habit)      ^  advanced      !  pick one child
 * (a name that is a question, e.g. "What is HTTP?", keeps its "?" as text).
 * Progress is a set of topic keys like "p1/programming-basics/loops". Keys come from
 * the names, so renaming a topic resets its tick.
 */

export type Tag = "do" | "opt" | "cont" | "adv";
export type ItemDef = [string] | [string, string[]];

export type PhaseDef = {
  id: string;
  title: string;
  short: string;
  description: string;
  ongoing?: boolean;
  items: ItemDef[];
};

export type RoadmapDef = {
  slug: string;
  title: string;
  years?: string;
  tagline: string;
  category: string;
  level: string;
  /** localStorage key for progress on this device */
  localKey: string;
  credit?: { text: string };
  phases: PhaseDef[];
};

type RoadmapJsonDef = Omit<RoadmapDef, "phases"> & {
  phases: Array<Omit<PhaseDef, "items"> & { items: Array<Array<string | string[]>> }>;
};

function normalizeItem(item: Array<string | string[]>): ItemDef {
  const [name, children] = item;
  if (typeof name !== "string")
    throw new Error("Roadmap item must start with a name");
  if (children === undefined && item.length === 1)
    return [name];
  if (item.length === 2 && Array.isArray(children) && children.every((child): child is string => typeof child === "string"))
    return [name, children];
  throw new Error(`Invalid roadmap item: ${name}`);
}

/** Normalize JSON arrays into the tuple types used by the roadmap model. */
export function normalizeRoadmapDef(def: RoadmapJsonDef): RoadmapDef {
  return {
    ...def,
    phases: def.phases.map((phase) => ({
      ...phase,
      items: phase.items.map(normalizeItem),
    })),
  };
}

export type Row = { key: string; name: string; tag: Tag };
export type Card = {
  id: string; title: string; tag: Tag; mode: "list" | "pick"; rows: Row[]; phaseId: string;
  /** key of the roadmap item the card comes from; absent on "Key concepts" groups of standalone topics */
  key?: string;
};
export type Phase = {
  id: string;
  title: string;
  short: string;
  description: string;
  ongoing: boolean;
  num: number | null;
  cards: Card[];
};
export type Roadmap = {
  def: RoadmapDef;
  phases: Phase[];
  numbered: Phase[];
  ongoing: Phase[];
  byId: Record<string, Phase>;
  cardById: Record<string, Card>;
};

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Names phrased as questions ("What is HTTP?") keep their "?" instead of it meaning "optional". */
const QUESTION = /^(what|why|how|is|are|should|when|where|do|does|can|which|who)\b/i;

function parse(raw: string) {
  let s = raw, tag: Tag = "do", pick = false;
  while (/[?~^!]$/.test(s)) {
    const c = s.slice(-1);
    if (c === "?" && QUESTION.test(s.trim())) break;
    s = s.slice(0, -1);
    if (c === "?") tag = "opt";
    else if (c === "~") tag = "cont";
    else if (c === "^") tag = "adv";
    else pick = true;
  }
  return { name: s.trim(), tag, pick };
}

export function buildRoadmap(def: RoadmapDef): Roadmap {
  let num = 0, cardSeq = 0;
  const phases: Phase[] = def.phases.map((p) => {
    const ph: Phase = {
      id: p.id, title: p.title, short: p.short, description: p.description,
      ongoing: !!p.ongoing, num: p.ongoing ? null : ++num, cards: [],
    };
    let group: Card | null = null, groups = 0;
    for (const it of p.items) {
      const n = parse(it[0]);
      const key = p.id + "/" + slugify(n.name);
      const kids = (it[1] || []).map((k) => {
        const c = parse(k);
        // an untagged topic inherits its card's tag: everything under an optional card is optional, and so on
        const tag: Tag = c.tag === "do" ? n.tag : c.tag;
        return { key: key + "/" + slugify(c.name), name: c.name, tag };
      });
      if (!kids.length) {
        // single topics are gathered into a "Key concepts" card
        if (!group) {
          group = { id: "c" + ++cardSeq, title: groups++ ? "More concepts" : "Key concepts", tag: "do", mode: "list", rows: [], phaseId: p.id };
          ph.cards.push(group);
        }
        group.rows.push({ key, name: n.name, tag: n.tag });
        continue;
      }
      group = null;
      const card: Card = { id: "c" + ++cardSeq, title: n.name, tag: n.tag, mode: n.pick ? "pick" : "list", rows: [], phaseId: p.id, key };
      if (!n.pick && n.tag !== "opt" && kids.every((c) => c.tag === "opt"))
        card.rows.push({ key, name: "Learn the basics of " + n.name, tag: n.tag === "cont" ? "cont" : "do" });
      card.rows.push(...kids);
      ph.cards.push(card);
    }
    return ph;
  });
  const byId: Record<string, Phase> = {}, cardById: Record<string, Card> = {};
  for (const ph of phases) {
    byId[ph.id] = ph;
    for (const c of ph.cards) cardById[c.id] = c;
  }
  return { def, phases, numbered: phases.filter((p) => !p.ongoing), ongoing: phases.filter((p) => p.ongoing), byId, cardById };
}

/* ---------- progress ---------- */

export type Unit = { tag: Tag; done: boolean; key: string; label: string; ctx?: string; pick?: boolean; cardId: string };
export type Tally = { d: number; t: number };
export type Status = "done" | "current" | "started" | "upcoming" | "ongoing";

export function counted(tag: Tag, ph: Phase, countOpt: boolean) {
  return tag === "do" || tag === "adv" || (countOpt && tag === "opt") || (ph.ongoing && tag === "cont");
}

export function cardUnits(card: Card, done: Set<string>): Unit[] {
  if (card.mode === "pick")
    return [{ tag: card.tag, done: card.rows.some((r) => done.has(r.key)), key: card.rows[0].key, label: card.title, pick: true, cardId: card.id }];
  return card.rows.map((r) => ({ tag: r.tag, done: done.has(r.key), key: r.key, label: r.name, ctx: card.title, cardId: card.id }));
}

function tally(units: Unit[], ph: Phase, countOpt: boolean): Tally {
  let d = 0, t = 0;
  for (const u of units) if (counted(u.tag, ph, countOpt)) { t++; if (u.done) d++; }
  return { d, t };
}

export function cardTally(card: Card, ph: Phase, done: Set<string>, countOpt: boolean): Tally {
  if (card.mode === "pick") return { d: card.rows.some((r) => done.has(r.key)) ? 1 : 0, t: 1 };
  return tally(cardUnits(card, done), ph, countOpt);
}

export type Progress = {
  tallies: Record<string, Tally>;
  full: Record<string, boolean>;
  current: Phase | null;
  next: Unit | null;
  done: number;
  total: number;
  phasesDone: number;
  habitsDone: number;
  habitsTotal: number;
  status: (ph: Phase) => Status;
};

export function computeProgress(rm: Roadmap, done: Set<string>, countOpt: boolean): Progress {
  const tallies: Record<string, Tally> = {}, full: Record<string, boolean> = {};
  let D = 0, T = 0, phasesDone = 0, current: Phase | null = null;
  for (const ph of rm.phases) {
    const t = tally(ph.cards.flatMap((c) => cardUnits(c, done)), ph, countOpt);
    tallies[ph.id] = t;
    if (ph.ongoing) continue;
    const f = t.t > 0 && t.d === t.t;
    full[ph.id] = f;
    D += t.d; T += t.t;
    if (f) phasesDone++;
    else if (!current) current = ph;
  }
  let habitsDone = 0, habitsTotal = 0;
  for (const ph of rm.ongoing) { habitsDone += tallies[ph.id].d; habitsTotal += tallies[ph.id].t; }
  let next: Unit | null = null;
  if (current) {
    const cur: Phase = current;
    outer: for (const c of cur.cards)
      for (const u of cardUnits(c, done))
        if (counted(u.tag, cur, countOpt) && !u.done) { next = u; break outer; }
  }
  const status = (ph: Phase): Status => {
    if (ph.ongoing) return "ongoing";
    if (full[ph.id]) return "done";
    if (ph === current) return "current";
    return tallies[ph.id].d > 0 ? "started" : "upcoming";
  };
  return { tallies, full, current, next, done: D, total: T, phasesDone, habitsDone, habitsTotal, status };
}

/* ---------- recommended videos ---------- */

/** Where recommended videos attach. A card's main heading ("Programming basics") gets the videos for
 *  everything under it; "Key concepts" groups and "Pick one" cards attach them to each topic or choice. */
export type VideoSlot = { key: string; name: string; tag: Tag; whole: boolean };

export function videoSlots(card: Card): VideoSlot[] {
  if (card.key && card.mode === "list") return [{ key: card.key, name: card.title, tag: card.tag, whole: true }];
  return card.rows.map((r) => ({ key: r.key, name: r.name, tag: r.tag, whole: false }));
}

/** Every key a video can attach to, in roadmap order. */
export function allVideoKeys(rm: Roadmap): string[] {
  return Array.from(new Set(rm.phases.flatMap((ph) => ph.cards.flatMap((c) => videoSlots(c).map((v) => v.key)))));
}

export function topicCount(rm: Roadmap) {
  return computeProgress(rm, new Set(), false).total;
}

/** A short, one-way code for a topic key (FNV-1a), so progress can be checked without sending topic names. */
export function keyHash(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** One entry per counted topic (optional ones excluded); a "pick one" card is one entry, done when any choice is ticked.
 *  Entries are hashed (see keyHash) because they are sent to public pages. */
export function progressUnits(rm: Roadmap): string[][] {
  return progressUnitsByPhase(rm).flat();
}

/** The same units, grouped by numbered phase (for "which phase am I on" summaries). */
export function progressUnitsByPhase(rm: Roadmap): string[][][] {
  return rm.numbered.map((ph) =>
    ph.cards.flatMap((c) => (c.mode === "pick" ? [c.rows.map((r) => keyHash(r.key))] : c.rows.filter((r) => counted(r.tag, ph, false)).map((r) => [keyHash(r.key)]))));
}

/** Short labels for what a phase covers: card titles, or the topics themselves for "Key concepts" groups. */
export function phaseHighlights(ph: Phase, max = 8): { items: string[]; more: number } {
  const all = ph.cards.flatMap((c) => (c.key ? [c.title] : c.rows.map((r) => r.name))); // "Key concepts" groups have no key
  return { items: all.slice(0, max), more: Math.max(0, all.length - max) };
}
