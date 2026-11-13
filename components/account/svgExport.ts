/** Font stack used inside exported images (the page's web font isn't available to an SVG drawn as an image). */
export const EXPORT_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Save an on-page <svg> as a PNG at its viewBox size × `scale`. */
export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string, scale = 2) {
  downloadBlob(await svgToPngBlob(svg, scale), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** A same-origin or CORS-enabled image as a data: URL, so it survives being drawn into a PNG. */
export async function toDataUrl(src: string): Promise<string> {
  // no referrer: Google photo URLs can refuse requests that say which page they came from
  const res = await fetch(src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error("image load failed");
  const blob = await res.blob();
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
}

/** Render an on-page <svg> to a PNG blob. Images inside it must be data: URLs (see toDataUrl). */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.style.fontFamily = EXPORT_FONT;
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("render failed")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = vb.width * scale;
    canvas.height = vb.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, vb.width, vb.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!blob) throw new Error("export failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function fileSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
}

/** Shorten text for a fixed-width SVG line. */
export function clip(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}
