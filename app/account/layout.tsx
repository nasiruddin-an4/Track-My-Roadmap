import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { SiteFooter } from "@/components/SiteFooter";
import { CATALOG } from "@/lib/catalog";

export const metadata: Metadata = {
  title: { default: "Your account", template: "%s | Track My Roadmap" },
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountShell catalog={CATALOG}>{children}</AccountShell>
      <SiteFooter />
    </>
  );
}
