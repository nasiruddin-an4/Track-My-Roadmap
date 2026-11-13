import type { Metadata } from "next";
import { RoadCardView } from "@/components/account/RoadCardView";

export const metadata: Metadata = { title: "Road Card" };

export default function Page() {
  return <RoadCardView />;
}
