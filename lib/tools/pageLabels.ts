/** Page-number styles and positions. Its own file so the page-number form can show labels without loading pdf-lib. */

export type NumberStyle = "n" | "page-n" | "n-of-total" | "page-n-of-total";
export type Spot = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

export function pageLabel(style: NumberStyle, n: number, total: number): string {
  switch (style) {
    case "page-n": return `Page ${n}`;
    case "n-of-total": return `${n} / ${total}`;
    case "page-n-of-total": return `Page ${n} of ${total}`;
    default: return String(n);
  }
}
