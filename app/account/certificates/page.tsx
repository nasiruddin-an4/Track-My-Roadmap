import type { Metadata } from "next";
import { CertificatesView } from "@/components/account/CertificatesView";

export const metadata: Metadata = { title: "Certificates" };

export default function Page() {
  return <CertificatesView />;
}
