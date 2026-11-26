/*
 * Photo and signature sizes that Bangladeshi application forms ask for. Only sizes confirmed from official or
 * repeated sources are listed; circulars change, so the page always tells students to check theirs, and
 * "Custom" covers everything else. Add a form here and it appears in the resizer.
 */

export type SizeSpec = { width: number; height: number; maxKB?: number; minKB?: number };
export type SizePreset = SizeSpec & { id: string; label: string; detail: string };

export const PHOTO_PRESETS: SizePreset[] = [
  {
    id: "teletalk", label: "Government job (Teletalk)", width: 300, height: 300, maxKB: 100,
    detail: "Most government job forms on teletalk.com.bd",
  },
  {
    id: "du", label: "Dhaka University admission", width: 450, height: 550, minKB: 20,
    detail: "Plain white background",
  },
  {
    id: "passport", label: "Passport size, 35 × 45 mm", width: 413, height: 531,
    detail: "Prints at the right size (300 dpi)",
  },
];

export const SIGNATURE_PRESETS: SizePreset[] = [
  {
    id: "teletalk", label: "Government job (Teletalk)", width: 300, height: 80, maxKB: 60,
    detail: "Most government job forms on teletalk.com.bd",
  },
];

/** "300 × 300 px · up to 100 KB" */
export function describeSpec(s: SizeSpec): string {
  const limits = [s.minKB ? `at least ${s.minKB} KB` : "", s.maxKB ? `up to ${s.maxKB} KB` : ""].filter(Boolean).join(", ");
  return `${s.width} × ${s.height} px${limits ? ` · ${limits}` : ""}`;
}
