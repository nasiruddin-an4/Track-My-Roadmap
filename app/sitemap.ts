import type { MetadataRoute } from "next";
import { ROADMAPS } from "@/content/roadmaps";
import { SITE_URL } from "@/lib/site";

/** sitemap.xml: the public pages. New roadmaps are added automatically. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/roadmaps`, changeFrequency: "weekly", priority: 0.9 },
    ...ROADMAPS.map((rm) => ({
      url: `${SITE_URL}/roadmaps/${rm.def.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/habits`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
