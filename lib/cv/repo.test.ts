/*
 * Ownership: every query must be limited to the signed-in person. Row level security (supabase/cv.sql) is the
 * database's guard; these tests check the app's own filter, against a fake database that applies `.eq()` filters
 * and nothing else, so a missing user filter would show up as a leak.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCv, deleteCv, duplicateCv, getCv, isCvId, listCvs, setPrimary, setShareToken, updateCv } from "./repo.ts";
import { emptyCv } from "./schema.ts";

type Row = Record<string, unknown>;

function fakeDb(rows: Row[]) {
  let n = 0;
  const from = () => {
    const filters: [string, unknown][] = [], nots: [string, unknown][] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row = {};
    const run = (): Row[] => {
      if (op === "insert") {
        const now = new Date().toISOString();
        const r = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, title: "My CV", template_id: "classic", page_size: "a4",
          is_primary: false, created_at: now, updated_at: now, ...payload };
        rows.push(r);
        return [r];
      }
      const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v) && nots.every(([c, v]) => r[c] !== v));
      if (op === "update") hit.forEach((r) => Object.assign(r, payload));
      if (op === "delete") hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
      return hit;
    };
    const q = {
      select: () => q,
      order: () => q,
      insert: (p: Row) => { op = "insert"; payload = p; return q; },
      update: (p: Row) => { op = "update"; payload = p; return q; },
      delete: () => { op = "delete"; return q; },
      eq: (c: string, v: unknown) => { filters.push([c, v]); return q; },
      neq: (c: string, v: unknown) => { nots.push([c, v]); return q; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: run()[0], error: null }),
      then: (ok: (v: { data: Row[]; error: null }) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok, bad),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

async function setup() {
  const rows: Row[] = [];
  const sb = fakeDb(rows);
  const a = await createCv(sb, A, { title: "A’s CV", pageSize: "a4", data: emptyCv({ name: "Ann" }) });
  await createCv(sb, B, { title: "B’s CV", pageSize: "letter", data: emptyCv({ name: "Bob" }) });
  return { rows, sb, a };
}

test("a new CV belongs to the person who made it", async () => {
  const { rows, a } = await setup();
  assert.equal(rows.find((r) => r.id === a.id)?.user_id, A);
});

test("the list shows only your own CVs", async () => {
  const { sb } = await setup();
  assert.deepEqual((await listCvs(sb, A)).map((c) => c.title), ["A’s CV"]);
  assert.deepEqual((await listCvs(sb, B)).map((c) => c.title), ["B’s CV"]);
});

test("someone else can't read your CV, even with its id", async () => {
  const { sb, a } = await setup();
  assert.equal((await getCv(sb, A, a.id))?.title, "A’s CV");
  assert.equal(await getCv(sb, B, a.id), null);
});

test("someone else can't change your CV", async () => {
  const { sb, rows, a } = await setup();
  assert.equal(await updateCv(sb, B, a.id, { title: "hacked" }), null);
  assert.equal(rows.find((r) => r.id === a.id)?.title, "A’s CV");
  assert.equal((await updateCv(sb, A, a.id, { title: "Frontend CV", pageSize: "letter" }))?.title, "Frontend CV");
});

test("someone else can't delete your CV", async () => {
  const { sb, rows, a } = await setup();
  assert.equal(await deleteCv(sb, B, a.id), null);
  assert.equal(rows.length, 2);
  assert.deepEqual(await deleteCv(sb, A, a.id), { sourceFilePath: null });
  assert.equal(rows.length, 1);
});

test("malformed ids never reach the database", async () => {
  const { sb } = await setup();
  assert.equal(isCvId("1; drop table cvs"), false);
  assert.equal(await getCv(sb, A, "not-a-uuid"), null);
  assert.equal(await deleteCv(sb, A, "../../etc"), null);
});

test("you can duplicate your own CV, not someone else's", async () => {
  const { sb, rows, a } = await setup();
  assert.equal(await duplicateCv(sb, B, a.id), null);
  const copy = await duplicateCv(sb, A, a.id);
  assert.equal(copy?.title, "Copy of A’s CV");
  assert.equal(rows.find((r) => r.id === copy?.id)?.user_id, A);
  assert.equal(rows.length, 3);
});

test("only one primary CV, and only your own can be made primary", async () => {
  const { sb, rows, a } = await setup();
  const second = await createCv(sb, A, { title: "Second", pageSize: "a4", data: emptyCv() });
  const bobs = rows.find((r) => r.user_id === B)!;
  bobs.is_primary = true;
  assert.equal(await setPrimary(sb, A, a.id, true), true);
  assert.equal(await setPrimary(sb, A, second.id, true), true);
  const primaries = rows.filter((r) => r.user_id === A && r.is_primary).map((r) => r.id);
  assert.deepEqual(primaries, [second.id]);
  assert.equal(bobs.is_primary, true); // Bob's own primary CV is untouched
  assert.equal(await setPrimary(sb, B, a.id, true), false);
});

test("only the owner can turn sharing on or off", async () => {
  const { sb, rows, a } = await setup();
  const token = "abcdefghijklmnopqrstuvwxyz012345";
  assert.equal(await setShareToken(sb, B, a.id, token), false);
  assert.equal(rows.find((r) => r.id === a.id)?.share_token, undefined);
  assert.equal(await setShareToken(sb, A, a.id, token), true);
  assert.equal((await getCv(sb, A, a.id))?.shareToken, token);
  assert.equal(await setShareToken(sb, A, a.id, null), true);
  assert.equal((await getCv(sb, A, a.id))?.shareToken, null);
});
