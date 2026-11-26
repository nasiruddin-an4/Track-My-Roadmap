import assert from "node:assert/strict";
import { test } from "node:test";
import { clampOffset, cleanSignature, coverScale, setJpegDpi } from "./imageMath.ts";

function pixels(colors: [number, number, number][]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b], i) => px.set([r, g, b, 255], i * 4));
  return px;
}

test("signature cleaning: grey paper and its shadow turn white, ink stays dark and keeps its colour", () => {
  // mostly paper (200), some shadow (175), some blue ink
  const paper: [number, number, number] = [200, 200, 196];
  const shadow: [number, number, number] = [176, 176, 172];
  const ink: [number, number, number] = [30, 40, 120];
  const px = pixels([...Array(80).fill(paper), ...Array(12).fill(shadow), ...Array(8).fill(ink)]);
  cleanSignature(px, 0.5);
  assert.deepEqual([...px.slice(0, 4)], [255, 255, 255, 255], "paper");
  assert.deepEqual([...px.slice(80 * 4, 80 * 4 + 4)], [255, 255, 255, 255], "shadow");
  const [r, g, b] = px.slice(92 * 4, 92 * 4 + 3);
  assert.ok(b > r && b > g, "ink is still blue");
  assert.ok(r < 40 && g < 40, "ink is a little darker");
});

test("signature cleaning: low strength keeps light strokes that high strength removes", () => {
  const make = () => pixels([...Array(90).fill([210, 210, 210]), ...Array(10).fill([150, 150, 150])]);
  const gentle = make(), strong = make();
  cleanSignature(gentle, 0);
  cleanSignature(strong, 1);
  assert.ok(gentle[90 * 4] < 255, "a light pencil stroke survives at low strength");
  assert.equal(strong[90 * 4], 255);
});

test("JPEG print resolution", () => {
  const header = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const out = setJpegDpi(header, 300);
  assert.deepEqual([...out.slice(13, 18)], [1, 1, 44, 1, 44]);
  assert.equal(header[13], 0, "the original is left alone");
  const exifFirst = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 8]);
  assert.deepEqual(setJpegDpi(exifFirst, 300), exifFirst);
});

test("crop zoom range", () => {
  // a 4000×3000 photo in a square frame: zoom 1 fills it, zoom 0.75 shows it all
  const z = coverScale(4000, 3000, 300, 300);
  assert.equal(z.cover, 0.1);
  assert.ok(Math.abs(z.minZoom - 0.75) < 1e-9);
});

test("dragging stays within bounds", () => {
  // image 1.5× the frame width: it can move a quarter of the frame either way, and not at all vertically
  assert.deepEqual(clampOffset({ x: 0.9, y: 0.2 }, 1.5, 1), { x: 0.25, y: 0 });
  // image half the frame: it can move a quarter either way but not leave the frame
  assert.deepEqual(clampOffset({ x: -0.9, y: 0.1 }, 0.5, 0.5), { x: -0.25, y: 0.1 });
});
