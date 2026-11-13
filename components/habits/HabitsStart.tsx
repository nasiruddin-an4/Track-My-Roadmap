"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/components/auth";
import { Arrow } from "@/components/icons";
import { SignInButton } from "@/components/SignInButton";
import { habitSummary, type HabitDoc } from "@/lib/habits";
import { HABITS_KEY } from "@/lib/storage";
import { useLocalItem } from "@/lib/useLocal";

const TRACK = "/habits/track";

/** Your habit progress (today and this month), read from this device's synced copy. */
function useHabitSummary() {
  const raw = useLocalItem(HABITS_KEY);
  return useMemo(() => {
    try {
      const d = raw ? (JSON.parse(raw) as HabitDoc) : null;
      if (!d || !Array.isArray(d.habits) || !d.updatedAt) return null;
      return habitSummary({ habits: d.habits, checks: d.checks || {} }, new Date());
    } catch {
      return null;
    }
  }, [raw]);
}

/** "Start tracking": signed in goes straight to the tracker, signed out signs in with Google first. */
export function HabitsStart({ note = true }: { note?: boolean }) {
  const { configured, ready, user } = useAuth();
  const sum = useHabitSummary();
  const signedIn = !configured || !!user;

  return (
    <div className="grid justify-items-start gap-3">
      {signedIn ? (
        <Link href={TRACK} prefetch className="inline-flex min-h-12 items-center gap-2.5 rounded-[12px] bg-route px-5 text-base font-semibold text-route-ink hover:brightness-110">
          {sum ? "Open my habit tracker" : "Start tracking"} <Arrow />
        </Link>
      ) : ready ? (
        <SignInButton primary label="Start tracking" next={TRACK} />
      ) : (
        <span className="inline-flex min-h-12 items-center rounded-[12px] bg-route px-5 font-semibold text-route-ink opacity-60">Start tracking</span>
      )}
      {note && (
        <p className="m-0 max-w-[46ch] text-[.9rem] text-muted">
          {user
            ? <>Signed in as <b className="font-semibold text-ink">{user.email}</b>. Your habits are saved to your account.</>
            : configured
              ? "Free. You’ll sign in with Google so your habits are saved to your account and follow you to every device."
              : "Free. Your habits are saved in this browser."}
        </p>
      )}
    </div>
  );
}
