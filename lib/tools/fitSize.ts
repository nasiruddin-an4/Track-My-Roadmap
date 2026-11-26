/*
 * Finds the best-looking encoding of an image that fits a file-size limit (e.g. "under 100 KB").
 * It lowers the JPEG/WebP quality first and only then makes the picture smaller, so a photo keeps as much
 * detail as the limit allows. The encoder is passed in, so the search is plain code the unit tests can run.
 *
 * No runtime imports: the unit tests run this file directly.
 */

export type FitOptions = {
  /** largest allowed size in bytes (no limit when left out) */
  maxBytes?: number;
  /** smallest allowed size in bytes, for forms that reject tiny files */
  minBytes?: number;
  /** false for PNG: quality does nothing, only the dimensions can change */
  lossy?: boolean;
  /** false when the pixel size is fixed (application photos must be exactly 300×300) */
  canShrink?: boolean;
  maxQuality?: number;
  minQuality?: number;
  /** never shrink below this fraction of the original width and height */
  minScale?: number;
};

export type FitResult<T> = {
  out: T;
  quality: number;
  scale: number;
  /** the result is within both limits */
  fits: boolean;
};

type Encode<T> = (quality: number, scale: number) => Promise<T>;

export async function fitToSize<T extends { size: number }>(encode: Encode<T>, o: FitOptions = {}): Promise<FitResult<T>> {
  const lossy = o.lossy ?? true;
  const canShrink = o.canShrink ?? true;
  const max = o.maxBytes ?? Infinity;
  const min = o.minBytes ?? 0;
  const qMax = o.maxQuality ?? 0.92;
  // a fixed-size photo has to fit, so its quality may drop further than a general compression would
  const qMin = o.minQuality ?? (canShrink ? 0.45 : 0.08);
  const sMin = o.minScale ?? 0.05;
  const result = (out: T, quality: number, scale: number): FitResult<T> =>
    ({ out, quality, scale, fits: out.size <= max && out.size >= min });

  const first = await encode(qMax, 1);
  if (first.size <= max) {
    if (first.size >= min || !lossy) return result(first, qMax, 1);
    // under the form's minimum: use the highest quality and hope that's enough
    const top = await encode(1, 1);
    return result(top.size <= max ? top : first, top.size <= max ? 1 : qMax, 1);
  }
  if (!canShrink && !lossy) return result(first, qMax, 1);

  if (!lossy) {
    // PNG: only smaller dimensions make a smaller file; file size grows roughly with the pixel count
    let scale = 1, last = first;
    for (let i = 0; i < 8; i++) {
      scale = Math.max(sMin, scale * Math.sqrt(max / last.size) * 0.96);
      last = await encode(qMax, scale);
      if (last.size <= max || scale === sMin) break;
    }
    return result(last, qMax, scale);
  }

  // far too big at full size: jump straight to a smaller size instead of searching from the top
  let scale = canShrink && first.size > 4 * max ? Math.max(sMin, Math.sqrt((2.5 * max) / first.size)) : 1;
  let smallest: FitResult<T> = result(first, qMax, 1);
  for (let round = 0; round < 8; round++) {
    const top = scale === 1 ? first : await encode(qMax, scale);
    if (top.size <= max) return result(top, qMax, scale);
    const low = await encode(qMin, scale);
    if (low.size < smallest.out.size) smallest = result(low, qMin, scale);
    if (low.size <= max) {
      // highest quality that still fits, by halving the gap 6 times (within ~1% of the best)
      let lo = qMin, hi = qMax, best = low;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        const r = await encode(mid, scale);
        if (r.size <= max) { best = r; lo = mid; } else hi = mid;
      }
      return result(best, lo, scale);
    }
    if (!canShrink || scale === sMin) break;
    scale = Math.max(sMin, scale * Math.sqrt(max / low.size) * 0.95);
  }
  return smallest;
}
