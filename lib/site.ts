/** Site-wide constants for SEO files (sitemap, robots, llms.txt). */
export const SITE_URL = "https://www.trackmyroadmap.com";
export const SITE_NAME = "Track My Roadmap";

/** Pages that are only for signed-in users; crawlers are asked to skip them. */
export const PRIVATE_PATHS = ["/roadmaps/*/track", "/habits/track", "/auth/", "/login", "/signup", "/account", "/admin"];

const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "Track My Roadmap: career roadmaps and a daily habit tracker" };

/**
 * Title, description, canonical URL and share-card tags for one page.
 * (Next.js replaces the whole openGraph/twitter object per page, so the share image is repeated here.)
 * `title` gets " | Track My Roadmap" from the layout template; share cards use the full title.
 */
export function pageMeta(title: string, description: string, path: string) {
  const full = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website" as const, siteName: SITE_NAME, title: full, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image" as const, title: full, description, images: [OG_IMAGE.url] },
  };
}
