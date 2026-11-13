import type { Metadata } from "next";
import { FriendsView } from "@/components/account/FriendsView";

export const metadata: Metadata = { title: "Friends" };

export default function Page() {
  return <FriendsView />;
}
