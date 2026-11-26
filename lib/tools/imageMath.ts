/*
 * Pixel and byte work for application photos, kept free of the DOM so the unit tests can run it.
 * No runtime imports: the unit tests run this file directly.
 */

/**
 * Turns a phone photo of a signature on paper into clean ink on white: the paper (and its shadows) becomes
 * pure white, the ink stays its own colour, a little darker. `strength` 0–1: higher removes more shadow but
 * can lose very light strokes. Works in place on RGBA pixels.
 */
export function cleanSignature(px: Uint8ClampedArray, strength = 0.5): void {
  const hist = new Uint32Array(256);
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) hist[luma(px[i], px[i + 1], px[i + 2])]++;
  // the paper is most of the picture, so the median brightness is the paper's
  let seen = 0, paper = 255;
  for (let v = 0; v < 256; v++) { seen += hist[v]; if (seen >= n / 2) { paper = v; break; } }
  const s = Math.min(1, Math.max(0, strength));
  const hi = Math.max(24, paper * (0.92 - 0.22 * s)); // at or above: paper → white
  const lo = hi * 0.6; // at or below: ink
  for (let i = 0; i < px.length; i += 4) {
    const t = Math.min(1, Math.max(0, (luma(px[i], px[i + 1], px[i + 2]) - lo) / (hi - lo)));
    for (let c = 0; c < 3; c++) px[i + c] = px[i + c] * 0.8 * (1 - t) + 255 * t;
    px[i + 3] = 255;
  }
}

function luma(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Writes the print resolution (dots per inch) into a JPEG's JFIF header, so a 413×531 photo prints at
 * 35×45 mm. Browsers save canvases at 72 or 96 dpi. Returns a copy; unchanged if there's no JFIF header.
 */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
  const out = jpeg.slice();
  const isJfif = out[0] === 0xff && out[1] === 0xd8 && out[2] === 0xff && out[3] === 0xe0
    && out[6] === 0x4a && out[7] === 0x46 && out[8] === 0x49 && out[9] === 0x46 && out[10] === 0;
  if (!isJfif) return out;
  out[13] = 1; // units: dots per inch
  out[14] = dpi >> 8; out[15] = dpi & 255;
  out[16] = dpi >> 8; out[17] = dpi & 255;
  return out;
}

/** The zoom range for a crop frame of `fw`×`fh` over an image of `iw`×`ih`: 1 fills the frame, less shows all of it. */
export function coverScale(iw: number, ih: number, fw: number, fh: number) {
  const cover = Math.max(fw / iw, fh / ih);
  const contain = Math.min(fw / iw, fh / ih);
  return { cover, minZoom: contain / cover };
}

/**
 * Keeps a dragged image in a sensible place: a picture bigger than the frame always covers it; a smaller one
 * stays inside it. Offsets are fractions of the frame, measured from its centre.
 */
export function clampOffset(off: { x: number; y: number }, imgFracW: number, imgFracH: number) {
  const mx = Math.abs(imgFracW - 1) / 2, my = Math.abs(imgFracH - 1) / 2;
  return { x: Math.min(mx, Math.max(-mx, off.x)), y: Math.min(my, Math.max(-my, off.y)) };
}
