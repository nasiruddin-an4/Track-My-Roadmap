import type { NextConfig } from "next";

/** Security headers for every response. (No frame embedding of this site; YouTube embeds still work because
 *  Referrer-Policy sends the origin, which YouTube's player requires.) */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  cacheComponents: true,
  // CV PDF rendering and CV file reading load their own engines and fonts at run time; keep them out of the bundle
  serverExternalPackages: ["@react-pdf/renderer", "unpdf", "mammoth"],
  // Bengali CVs embed Hind Siliguri, read from disk by lib/cv/pdf.tsx; ship the files with the routes that make PDFs
  outputFileTracingIncludes: {
    "/api/cv/**/*": ["./lib/cv/fonts/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
