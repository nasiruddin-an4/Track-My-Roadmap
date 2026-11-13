"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth";
import { useLocalProgress } from "@/components/home/CardProgress";
import { Arrow } from "@/components/icons";
import { SignInButton } from "@/components/SignInButton";

/**
 * "Start progress" on a roadmap overview. Signed in: straight to the tracker.
 * Signed out: Google sign-in first, then back to the tracker.
 */
export function StartButton({ slug, localKey, units, note = true }: { slug: string; localKey: string; units: string[][]; note?: boolean }) {
  const { configured, ready, user } = useAuth();
  const pct = useLocalProgress(localKey, units);
  const track = `/roadmaps/${slug}/track`;
  const signedIn = !configured || !!user;

  return (
    <div className="grid justify-items-start gap-3">
      {signedIn ? (
        <Link href={track} prefetch className="inline-flex min-h-12 items-center gap-2.5 rounded-[12px] bg-route px-5 text-base font-semibold text-route-ink hover:brightness-110">
          {pct !== null ? `Continue progress · ${pct}%` : "Start progress"} <Arrow />
        </Link>
      ) : ready ? (
        <SignInButton primary label="Start progress" next={track} />
      ) : (
        <span className="inline-flex min-h-12 items-center rounded-[12px] bg-route px-5 font-semibold text-route-ink opacity-60">Start progress</span>
      )}
      {note && (
        <p className="m-0 max-w-[44ch] text-[.9rem] text-muted">
          {user
            ? <>Signed in as <b className="font-semibold text-ink">{user.email}</b>. Your progress is saved to your account.</>
            : configured
              ? "Free. You’ll sign in with Google so your progress is saved to your account and follows you to every device."
              : "Free. Your progress is saved in this browser."}
        </p>
      )}
    </div>
  );
}
