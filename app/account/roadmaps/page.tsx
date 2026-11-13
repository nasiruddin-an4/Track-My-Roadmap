import type { Metadata } from "next";
import { RoadmapsView } from "@/components/account/RoadmapsView";

export const metadata: Metadata = { title: "Your roadmaps" };

export default function Page() {
  return <RoadmapsView />;
}
