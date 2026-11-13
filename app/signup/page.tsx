import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel, AuthPanelFromUrl } from "@/components/AuthPanel";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta("Sign up", "Create a free Track My Roadmap account to save your roadmap and habit progress across devices.", "/signup"),
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <Suspense fallback={<AuthPanel mode="signup" next="/" />}>
      <AuthPanelFromUrl mode="signup" />
    </Suspense>
  );
}
