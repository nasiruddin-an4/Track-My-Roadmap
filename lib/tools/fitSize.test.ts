import assert from "node:assert/strict";
import { test } from "node:test";
import { fitToSize } from "./fitSize.ts";

/** A stand-in encoder: file size grows with quality and with the pixel count (scale²), like a real JPEG. */
function fakeJpeg(pixels: number) {
  const calls: [number, number][] = [];
  const encode = async (q: number, s: number) => {
    calls.push([q, s]);
    return { size: Math.round(pixels * s * s * (0.04 + 0.5 * q * q)), q, s };
  };
  return { encode, calls };
}

test("already small enough: one encode at high quality", async () => {
  const { encode, calls } = fakeJpeg(90_000); // a 300×300 photo
  const r = await fitToSize(encode, { maxBytes: 100 * 1024 });
  assert.equal(r.fits, true);
  assert.equal(r.quality, 0.92);
  assert.equal(calls.length, 1);
});

test("lowers quality before shrinking, and picks the best quality that fits", async () => {
  const { encode } = fakeJpeg(1_000_000);
  const max = 200 * 1024;
  const r = await fitToSize(encode, { maxBytes: max });
  assert.equal(r.fits, true);
  assert.equal(r.scale, 1, "quality alone was enough, so the picture keeps its size");
  assert.ok(r.out.size <= max);
  const better = await encode(r.quality + 0.02, 1);
  assert.ok(better.size > max, "a little more quality would no longer fit");
});

test("shrinks the picture when quality alone can't reach the limit", async () => {
  const { encode } = fakeJpeg(12_000_000); // a 12-megapixel phone photo
  const r = await fitToSize(encode, { maxBytes: 50 * 1024 });
  assert.equal(r.fits, true);
  assert.ok(r.scale < 1);
  assert.ok(r.out.size <= 50 * 1024);
  assert.ok(r.out.size > 30 * 1024, "doesn't throw away far more than needed");
});

test("fixed-size photos keep their pixel size and drop quality instead", async () => {
  const { encode, calls } = fakeJpeg(800_000);
  const r = await fitToSize(encode, { maxBytes: 60 * 1024, canShrink: false });
  assert.equal(r.fits, true);
  assert.ok(calls.every(([, s]) => s === 1));
  assert.ok(r.quality < 0.45);
});

test("reports when even the lowest quality is too big for a fixed size", async () => {
  const { encode } = fakeJpeg(50_000_000);
  const r = await fitToSize(encode, { maxBytes: 10 * 1024, canShrink: false });
  assert.equal(r.fits, false);
  assert.equal(r.scale, 1);
});

test("PNG: only the dimensions change", async () => {
  const calls: number[] = [];
  const encode = async (_q: number, s: number) => { calls.push(s); return { size: Math.round(3_000_000 * s * s) }; };
  const r = await fitToSize(encode, { maxBytes: 500 * 1024, lossy: false });
  assert.equal(r.fits, true);
  assert.ok(r.scale < 1 && r.scale > 0.3);
});

test("raises quality to meet a form's minimum size", async () => {
  const { encode } = fakeJpeg(40_000);
  const r = await fitToSize(encode, { minBytes: 20 * 1024 });
  assert.equal(r.quality, 1);
  assert.equal(r.fits, r.out.size >= 20 * 1024);
});

test("no limits: just a good-quality encode", async () => {
  const { encode, calls } = fakeJpeg(5_000_000);
  const r = await fitToSize(encode);
  assert.equal(r.fits, true);
  assert.equal(calls.length, 1);
});
