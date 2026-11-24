"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth";
import { Logo } from "@/components/icons";
import { SignInButton } from "@/components/SignInButton";

/**
 * Shown by the server in place of a private page when the visitor isn't signed in, so the page's
 * content never reaches them. If the browser turns out to have a session (e.g. it just refreshed an
 * expired one), ask the server for the page again.
 */
export function SignInGate({ title, heading, backHref, backLabel }: { title: string; heading?: string; backHref: string; backLabel: string }) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (user) router.refresh(); }, [user, router]);

  return (
    <div className="wrap grid place-items-center py-16 sm:py-24">
      <div className="grid w-full max-w-[440px] gap-5 rounded-[22px] border border-line bg-surface p-7 sm:p-9">
        <Logo size={44} className="rounded-[11px]" />
        <div className="grid gap-2">
          <h1 className="m-0 font-display text-[clamp(1.6rem,5vw,2rem)] leading-tight font-bold tracking-[-.03em] text-balance">
            {user ? "Opening…" : heading ?? `Sign in to track ${title}`}
          </h1>
          <p className="m-0 text-muted">Everything you track is saved to your Google account, so it’s there on your phone, laptop and every other device. It’s free.</p>
        </div>
        {!user && <SignInButton primary label="Continue with Google" className="w-full" />}
        <Link href={backHref} className="text-center text-[.92rem] font-semibold text-route hover:underline">{backLabel}</Link>
      </div>
    </div>
  );
}
