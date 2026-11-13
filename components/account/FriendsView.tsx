"use client";

import { useState } from "react";
import { PageHead } from "@/components/account/ui";
import { SITE_URL } from "@/lib/site";

/* Friends needs its own tables (friend requests, what friends may see), so for now this invites people to the site. */
export function FriendsView() {
  const [copied, setCopied] = useState(false);
  const text = "I’m tracking my tech learning on Track My Roadmap. Free roadmaps + a habit tracker. Join me:";

  async function invite() {
    if (navigator.share) {
      try { await navigator.share({ title: "Track My Roadmap", text, url: SITE_URL }); return; }
      catch (e) { if ((e as Error)?.name === "AbortError") return; /* closed the share sheet; anything else: copy instead */ }
    }
    try { await navigator.clipboard.writeText(`${text} ${SITE_URL}`); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Copy this invite:", `${text} ${SITE_URL}`); }
  }

  return (
    <>
      <PageHead title="Friends" lead="Learn together and keep each other going." />
      <div className="grid justify-items-center gap-4 rounded-[20px] border border-line bg-surface px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-route-soft text-route">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6" />
          </svg>
        </span>
        <span className="rounded-full bg-warm/10 px-3 py-1 text-[.78rem] font-semibold text-warm">Coming soon</span>
        <h2 className="m-0 font-display text-[1.45rem] font-bold tracking-[-.02em]">Follow your friends’ progress</h2>
        <p className="m-0 max-w-[48ch] text-muted">
          Soon you’ll be able to add friends, see which roadmaps they’re on and cheer each other on. Invite them now so they’re ready.
        </p>
        <button type="button" onClick={invite} className="mt-1 inline-flex h-11 items-center rounded-xl bg-route px-5 font-semibold text-route-ink hover:brightness-110">
          {copied ? "Invite copied!" : "Invite a friend"}
        </button>
      </div>
    </>
  );
}
