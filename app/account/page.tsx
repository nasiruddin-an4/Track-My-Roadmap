import type { Metadata } from "next";
import { ActivityView } from "@/components/account/ActivityView";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <ActivityView />;
}
