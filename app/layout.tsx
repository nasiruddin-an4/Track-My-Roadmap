import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/toast";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500"] });

const HOME_TITLE = "Track My Roadmap — Free Tech Career Roadmaps & Habit Tracker";
const DESCRIPTION =
  "Track My Roadmap offers free tech career roadmaps, topic-by-topic progress tracking, and a habit tracker to help you learn what’s next and stay on course.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: "%s | Track My Roadmap" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "track my roadmap",
    "software engineer roadmap",
    "software engineering roadmap",
    "frontend developer roadmap",
    "AI engineer roadmap",
    "developer roadmap",
    "programming roadmap",
    "tech career roadmap",
    "developer learning roadmap",
    "roadmap progress tracker",
    "learning progress tracker",
    "habit tracker for learning",
  ],
  authors: [{ name: "Nasir Uddin", url: "https://www.nasiruddin.net/" }],
  creator: "Nasir Uddin",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Track My Roadmap: career roadmaps and a daily habit tracker" }],
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
};

export const viewport: Viewport = { themeColor: "#FFFFFF", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<div className="site-top h-[var(--top)]" aria-hidden="true" />}>
              <SiteHeader />
            </Suspense>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
