import type { ToolGroup } from "@/lib/tools/registry";

const DOC = <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>;

const ICONS: Record<string, React.ReactNode> = {
  "photo-signature-resizer": <><rect x="4" y="3" width="16" height="18" rx="2.5" /><circle cx="12" cy="10" r="3" /><path d="M7.5 18c1-2.3 2.7-3.3 4.5-3.3s3.5 1 4.5 3.3" /></>,
  "compress-image": <><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></>,
  "convert-image": <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
  "image-to-pdf": <>{DOC}<circle cx="10" cy="12.5" r="1.5" /><path d="m19 17-3.5-3.5L9 20" /></>,
  "merge-pdf": <><path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.2 2.9L4 22" /><path d="m20 22-5-5" /></>,
  "split-pdf": <><path d="M16 3h5v5M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.2-2.9L3 3M15 9l6-6" /></>,
  "compress-pdf": <>{DOC}<path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" /></>,
  "pdf-to-image": <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  "pdf-page-numbers": <><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>,
  "bijoy-unicode-converter": <><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" /></>,
  "leave-application": <>{DOC}<path d="M8.5 13h7M8.5 16.5h4.5" /></>,
  "testimonial-application": <>{DOC}<circle cx="12" cy="13.5" r="2.5" /><path d="m10.5 15.6-1 3.4 2.5-1.2 2.5 1.2-1-3.4" /></>,
  "cover-letter": <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></>,
  "assignment-cover-page": <><path d="M5 3h11l3 3v15H5z" /><path d="M9 8h6M8 12h8M10 16h4" /></>,
  "cv-builder": <>{DOC}<circle cx="12" cy="12" r="2" /><path d="M8.5 17.5c.7-1.6 2-2.4 3.5-2.4s2.8.8 3.5 2.4" /></>,
  "handwriting-to-text":<><path d="M3 19c2.5-1 4-3.5 5.5-7S11 5 12.5 5 13 9 12 12.5s-1 6 1 6c1.8 0 3-2.2 4-4" /><path d="M16 4.5 19.5 8M21 3l-1.5 1.5" /></>,
};

export const GROUP_TONE: Record<ToolGroup, string> = {
  forms: "bg-[rgba(255,90,0,.13)] text-highlight",
  templates: "bg-[rgba(242,164,98,.14)] text-warm",
  study: "bg-[rgba(174,155,255,.15)] text-adv",
  images: "bg-route-soft text-route",
  pdf: "bg-danger/12 text-danger",
  bangla: "bg-done-soft text-done",
};

export function ToolIcon({ slug, group, size = 44 }: { slug: string; group: ToolGroup; size?: number }) {
  return (
    <span className={"grid flex-none place-items-center rounded-xl " + GROUP_TONE[group]} style={{ width: size, height: size }}>
      <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[slug]}
      </svg>
    </span>
  );
}
