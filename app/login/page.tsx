import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel, AuthPanelFromUrl } from "@/components/AuthPanel";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta("Log in", "Log in to Track My Roadmap to pick up your roadmaps and habits where you left off.", "/login"),
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <Suspense fallback={<AuthPanel mode="login" next="/" />}>
      <AuthPanelFromUrl mode="login" />
    </Suspense>
  );
}
