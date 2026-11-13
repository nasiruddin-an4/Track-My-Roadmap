"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, type AccountData, type RoadmapStat } from "@/components/account/AccountData";
import { Loading, PageHead } from "@/components/account/ui";
import { clip, downloadBlob, fileSlug, svgToPngBlob, toDataUrl } from "@/components/account/svgExport";
import { SITE_URL } from "@/lib/site";

const LOGO_SRC = "/brand/logo-on-dark-solid.png"; // 504×144: white "Track My" text; the icon's white band, lane markings and red flag are solid (not see-through) so they show on the dark card

/** Google serves profile photos at 96px by default; ask for a sharper one. */
const sharpAvatar = (url: string) => url.replace(/=s\d+(-c)?$/, "=s256-c");

type Assets = { logo: string; avatar: string | null };
/** "overall" or a roadmap slug */
type CardKey = string;
type Link = { url: string | null; error?: string };

export function RoadCardView() {
  const a = useAccount();
  const svg = useRef<SVGSVGElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  /** signed link to this card's public page; social sites show the card image as its preview */
  const [selected, setSelected] = useState<CardKey>("overall");
  /** share links per card, keyed by card + a progress fingerprint so a new link is made when progress changes */
  const [links, setLinks] = useState<Record<string, Link>>({});
  const avatarUrl = a.profile.avatar;
  const ready0 = a.status === "ready";
  const stat: RoadmapStat | undefined = selected === "overall" ? undefined : a.roadmaps.find((r) => r.slug === selected);
  /** a roadmap that isn't started (e.g. from an old link) shows the overall card */
  const current: CardKey = stat ? stat.slug : "overall";
  const linkKey = stat ? `${stat.slug}:${stat.done}` : `overall:${a.topicsDone}:${a.roadmaps.length}:${a.completed.length}:${a.habits.streak}`;
  const link = links[linkKey] ?? null;

  // Open a specific roadmap's card when linked as /account/card?roadmap=<slug>.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("roadmap");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the URL once on arrival
    if (want) setSelected(want);
  }, []);

  // Ask the server for this card's share link (built from the progress saved to the account).
  useEffect(() => {
    if (!ready0 || links[linkKey]) return;
    let live = true;
    const q = new URLSearchParams({ tz: String(new Date().getTimezoneOffset()) });
    if (current !== "overall") q.set("roadmap", current);
    fetch(`/api/road-card?${q}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (live) setLinks((m) => ({ ...m, [linkKey]: r.ok && j.url ? { url: j.url } : { url: null, error: j.error } }));
      })
      .catch(() => { if (live) setLinks((m) => ({ ...m, [linkKey]: { url: null, error: "You seem to be offline." } })); });
    return () => { live = false; };
  }, [ready0, linkKey, current, links]);

  // Images go into the card as data: URLs so the downloaded PNG includes them.
  useEffect(() => {
    let live = true;
    Promise.all([
      toDataUrl(LOGO_SRC).catch(() => LOGO_SRC),
      avatarUrl
        ? toDataUrl(sharpAvatar(avatarUrl))
          .catch(() => toDataUrl(`/api/avatar?u=${encodeURIComponent(sharpAvatar(avatarUrl))}`)) // same-site copy if Google refuses the browser
          .catch(() => toDataUrl(avatarUrl))
          .catch(() => null) // initials
        : Promise.resolve(null),
    ]).then(([logo, avatar]) => { if (live) setAssets({ logo, avatar }); });
    return () => { live = false; };
  }, [avatarUrl]);

  // Phones (and some desktop browsers) can hand the image itself to LinkedIn, WhatsApp… through the share sheet.
  useEffect(() => {
    try {
      const probe = new File([new Blob(["x"], { type: "image/png" })], "probe.png", { type: "image/png" });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature check, once
      setCanShareFiles(!!navigator.canShare?.({ files: [probe] }));
    } catch { /* file sharing is not supported */ }
  }, []);

  if (a.status === "loading") return <Loading />;

  const text = caption ?? (stat ? roadmapCaption(stat) : defaultCaption(a));
  const fileName = `road-card-${fileSlug(a.profile.name)}${stat ? "-" + stat.slug : ""}.png`;
  const choose = (k: CardKey) => { setSelected(k); setCaption(null); setNotice(null); };
  const ready = !!assets;
  const shareUrl = link?.url ?? null;

  async function png(): Promise<Blob> {
    if (!svg.current) throw new Error("no card");
    return svgToPngBlob(svg.current);
  }

  async function download() {
    setBusy("download"); setNotice(null);
    try { downloadBlob(await png(), fileName); setNotice({ tone: "ok", text: "Your Road Card was downloaded." }); }
    catch { setNotice({ tone: "error", text: "Couldn’t create the image in this browser. Try another browser, or take a screenshot of the card." }); }
    finally { setBusy(null); }
  }

  async function nativeShare() {
    setBusy("share"); setNotice(null);
    try {
      const file = new File([await png()], fileName, { type: "image/png" });
      await navigator.share({ files: [file], title: "My Road Card", text: `${text}\n${shareUrl ?? SITE_URL}` });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setNotice({ tone: "error", text: "Sharing didn’t work here. Use Download and attach the image to your post." });
    } finally { setBusy(null); }
  }

  async function shareLink() {
    if (!shareUrl) return;
    if (!navigator.share) {
      await copyLink();
      return;
    }
    setBusy("link"); setNotice(null);
    try {
      await navigator.share({ title: "My Road Card", text, url: shareUrl });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        setNotice({ tone: "error", text: "Couldn’t open the share sheet. Copy your card link or choose a network below." });
    } finally { setBusy(null); }
  }

  /** Opens the network with the card's link: its preview is the card image, so nothing needs downloading. */
  async function shareTo(n: Network) {
    if (!shareUrl) return;
    setNotice(null);
    const popup = window.open(n.url(text, shareUrl), "_blank", "width=680,height=720");
    if (!popup) {
      setNotice({ tone: "error", text: "Your browser blocked the share window. Allow pop-ups and try again, or copy your card link." });
      return;
    }
    popup.opener = null;
    if (!n.prefill) {
      try {
        await navigator.clipboard.writeText(text);
        setNotice({ tone: "ok", text: `${n.label} opened with your Road Card preview. Your caption is copied—paste it into your post.` });
      } catch {
        setNotice({ tone: "error", text: `${n.label} opened with your Road Card preview. Paste your caption from the box below.` });
      }
    } else {
      setNotice({ tone: "ok", text: `${n.label} opened with your Road Card link and preview.` });
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setNotice({ tone: "ok", text: "Card link copied. Paste it into a post or message to show your Road Card preview." }); }
    catch { window.prompt("Copy your Road Card link:", shareUrl); }
  }

  async function copyCaption() {
    const full = `${text}\n${shareUrl ?? SITE_URL}`;
    try { await navigator.clipboard.writeText(full); setNotice({ tone: "ok", text: "Caption and card link copied." }); }
    catch { window.prompt("Copy your caption:", full); }
  }

  return (
    <>
      <PageHead title="Road Card" lead="Your learning journey, ready to share. Post the link for a rich social preview, or download the image for your portfolio." />

      <CardPicker a={a} selected={current} onChoose={choose} />

      <section aria-label="Road Card preview" className="overflow-hidden rounded-[24px] border border-line bg-surface p-2 shadow-[var(--shadow)] sm:p-3">
        <div className="overflow-hidden rounded-[17px] bg-[#0B1222]">
          {stat
            ? <RoadmapCardSvg a={a} s={stat} assets={assets} ref={svg} />
            : <RoadCardSvg a={a} assets={assets} ref={svg} />}
        </div>
      </section>
      <div className="mt-3 mb-8 flex flex-wrap items-center justify-between gap-2 text-[.84rem] text-muted">
        <span>Live preview · updates as your progress changes</span>
        <span>1200 × 630 · ready for social sharing</span>
      </div>

      <section aria-labelledby="shareH" className="grid gap-6 rounded-[24px] border border-line bg-surface p-5 sm:p-7">
        <div className="grid gap-2">
          <span className="font-mono text-[.72rem] font-semibold tracking-[.14em] text-route uppercase">Share your progress</span>
          <h2 id="shareH" className="m-0 font-display text-[1.45rem] font-bold tracking-[-.025em]">Let your progress speak</h2>
          <p className="m-0 max-w-[62ch] text-[.9rem] leading-relaxed text-muted">
            Share the card link to show your image preview automatically. No image attachment needed.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-bg px-3.5 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-route-soft text-route"><LinkIcon /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[.72rem] font-semibold text-muted">YOUR SHARE LINK</span>
              <span className="block truncate font-mono text-[.78rem] text-ink">
                {shareUrl ?? (link ? link.error ?? "Sharing links aren’t available right now." : "Creating your share link…")}
              </span>
            </span>
            <button type="button" onClick={copyLink} disabled={!shareUrl} aria-label="Copy Road Card link"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-ink disabled:opacity-50">
              <CopyIcon />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={shareLink} disabled={!shareUrl || !!busy}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-route px-4 text-[.92rem] font-semibold text-route-ink transition hover:brightness-110 disabled:opacity-60 sm:flex-none">
              <ShareIcon /> {busy === "link" ? "Opening…" : "Share link"}
            </button>
            {canShareFiles && (
              <button type="button" onClick={nativeShare} disabled={!ready || !!busy} aria-label="Share Road Card image"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 text-[.9rem] font-semibold transition hover:border-muted disabled:opacity-60">
                {busy === "share" ? "Preparing…" : "Share image"}
              </button>
            )}
            <button type="button" onClick={download} disabled={!ready || !!busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 text-[.9rem] font-semibold transition hover:border-muted disabled:opacity-60">
              <DownloadIcon /> {busy === "download" ? "Preparing…" : "PNG"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-line pt-5">
          <div>
            <h3 className="m-0 text-[.92rem] font-bold">Share directly to</h3>
            <p className="m-0 mt-1 text-[.8rem] text-muted">Your Road Card link creates the rich preview in the post.</p>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {NETWORKS.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => shareTo(n)} disabled={!shareUrl || !!busy}
                  className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-bg px-3 text-[.9rem] font-semibold transition hover:border-muted hover:bg-sunk disabled:opacity-60">
                  <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: n.color }}>{n.icon}</span>
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {notice && (
          <p role="status" className={"m-0 rounded-xl border px-3.5 py-2.5 text-[.9rem] " +
            (notice.tone === "ok" ? "border-done/30 bg-done-soft text-done" : "border-danger/40 bg-danger/10 text-danger")}>
            {notice.text}
          </p>
        )}

        <label className="grid gap-2 border-t border-line pt-5">
          <span className="flex items-center justify-between gap-3 text-[.9rem] font-semibold">
            Post caption
            <span className="flex gap-3 text-[.85rem] font-semibold">
              {caption !== null && <button type="button" onClick={() => setCaption(null)} className="text-muted hover:text-ink">Reset</button>}
              <button type="button" onClick={copyCaption} className="text-route hover:underline">Copy caption + link</button>
            </span>
          </span>
          <textarea value={text} onChange={(e) => setCaption(e.target.value)} rows={3}
            className="w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-3 text-[.95rem] leading-relaxed text-ink outline-none focus:border-route" />
          <span className="text-[.8rem] leading-relaxed text-muted">The link is a snapshot of your current progress. Share again after progress changes to create an updated card.</span>
        </label>
      </section>
    </>
  );
}

function defaultCaption(a: AccountData): string {
  const current = a.inProgress[0]?.title;
  const finished = a.completed.map((s) => s.title);
  if (!a.roadmaps.length) return "I just started my learning journey with Track My Roadmap 🚀 Step-by-step roadmaps for a career in tech.";
  const parts = [`I’ve completed ${a.topicsDone} topics across ${a.roadmaps.length} ${a.roadmaps.length === 1 ? "roadmap" : "roadmaps"} on Track My Roadmap 🚀`];
  if (finished.length) parts.push(`Finished: ${finished.slice(0, 2).join(" and ")}${finished.length > 2 ? ` and ${finished.length - 2} more` : ""} ✅`);
  if (current) parts.push(`Currently learning ${current}.`);
  if (a.habits.streak >= 3) parts.push(`${a.habits.streak}-day habit streak 🔥`);
  return parts.join(" ") + " #learning #techcareer";
}

function roadmapCaption(s: RoadmapStat): string {
  if (s.pct >= 100) return `I just completed the ${s.title} roadmap on Track My Roadmap ✅ All ${s.total} topics across ${s.phaseCount} phases. On to the next one! #learning #techcareer`;
  const now = s.current ? ` Now on Phase ${s.current.num}: ${s.current.title}.` : "";
  return `I’m ${s.pct}% through the ${s.title} roadmap on Track My Roadmap 🚀 ${s.done} of ${s.total} topics done.${now} #learning #techcareer`;
}

/* ---------- card picker ---------- */

function CardPicker({ a, selected, onChoose }: { a: AccountData; selected: CardKey; onChoose: (k: CardKey) => void }) {
  const items = [{ key: "overall", title: "All roadmaps" }, ...a.roadmaps.map((r) => ({ key: r.slug, title: r.title }))];
  return (
    <div className="mb-4">
      <p className="m-0 mb-2 text-[.84rem] font-semibold text-muted">Choose a card</p>
      <ul role="tablist" aria-label="Road Cards"
        className="-mx-4 m-0 flex list-none gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const on = it.key === selected;
          return (
            <li key={it.key} className="shrink-0">
              <button type="button" role="tab" aria-selected={on} onClick={() => onChoose(it.key)}
                className={"inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[.92rem] font-semibold whitespace-nowrap transition-colors " +
                  (on ? "border-route bg-route-soft/60 text-ink" : "border-line bg-surface text-muted hover:border-muted hover:text-ink")}>
                {it.key === "overall" && <span aria-hidden="true" className={on ? "text-route" : ""}>★</span>}
                {it.title}
              </button>
            </li>
          );
        })}
      </ul>
      {a.roadmaps.length === 0 && <p className="m-0 text-[.84rem] text-muted">Start a roadmap to get a card for it here too.</p>}
    </div>
  );
}

/* ---------- networks ---------- */

/** `prefill`: the network fills in the caption itself (Facebook doesn't allow that). */
type Network = { id: string; label: string; color: string; icon: React.ReactNode; prefill: boolean; url: (text: string, link: string) => string };
const enc = encodeURIComponent;
const glyph = (d: string) => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;

const NETWORKS: Network[] = [
  {
    id: "linkedin", label: "LinkedIn", color: "#0A66C2", prefill: false,
    url: (_t, l) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(l)}`,
    icon: glyph("M6.9 8.6H3.4V20h3.5V8.6ZM5.2 3a2 2 0 1 0 0 4.1A2 2 0 0 0 5.2 3Zm14.9 10c0-3-1.6-4.7-4.2-4.7-1.7 0-2.6.9-3.1 1.6V8.6H9.4V20h3.4v-5.8c0-1.5.3-3 2.2-3 1.8 0 1.8 1.7 1.8 3.1V20h3.4v-7Z"),
  },
  {
    id: "x", label: "X", color: "#000000", prefill: true,
    url: (t, l) => `https://x.com/intent/post?text=${enc(t)}&url=${enc(l)}`,
    icon: glyph("M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"),
  },
  {
    id: "facebook", label: "Facebook", color: "#1877F2", prefill: false,
    url: (_t, l) => `https://www.facebook.com/sharer/sharer.php?u=${enc(l)}`,
    icon: glyph("M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.2c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.8v3.1h2.6V21h3.1Z"),
  },
  {
    id: "whatsapp", label: "WhatsApp", color: "#25D366", prefill: true,
    url: (t, l) => `https://wa.me/?text=${enc(`${t}\n${l}`)}`,
    icon: glyph("M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.2 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3Z"),
  },
  {
    id: "telegram", label: "Telegram", color: "#229ED9", prefill: true,
    url: (t, l) => `https://t.me/share/url?url=${enc(l)}&text=${enc(t)}`,
    icon: glyph("M21.4 4.2 2.9 11.3c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.8-1.4-1.5ZM9 14l9.3-5.9c.5-.3.8-.1.5.2l-7.6 6.9-.3 3.2L9 14Z"),
  },
];

function ShareIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
}
function DownloadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" /></svg>;
}
function LinkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71" /></svg>;
}
function CopyIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>;
}

/* ---------- the card ---------- */

function RoadCardSvg({ a, assets, ref }: { a: AccountData; assets: Assets | null; ref: React.Ref<SVGSVGElement> }) {
  const W = 1200, H = 630;
  const top = [...a.inProgress, ...a.completed].sort((x, y) => y.pct - x.pct || y.updatedAt - x.updatedAt).slice(0, 3);
  const since = a.profile.joined ? new Date(a.profile.joined).toLocaleDateString("en", { month: "short", year: "numeric" }) : "";
  const stats = [
    { n: String(a.topicsDone), l: "topics done" },
    { n: String(a.roadmaps.length), l: a.roadmaps.length === 1 ? "roadmap" : "roadmaps" },
    { n: String(a.completed.length), l: "completed" },
    { n: `${a.habits.streak}d`, l: "day streak" },
  ];
  const AV = { cx: 124, cy: 210, r: 52 };

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Road Card for ${a.profile.name}`} className="block h-auto w-full"
      style={{ fontFamily: "var(--display), system-ui, sans-serif" }}>
      <defs>
        <linearGradient id="rc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#111B31" /><stop offset=".55" stopColor="#0D172A" /><stop offset="1" stopColor="#0A1020" />
        </linearGradient>
        <radialGradient id="rc-glow" cx=".9" cy=".06" r=".72">
          <stop offset="0" stopColor="#7C95FF" stopOpacity=".28" /><stop offset="1" stopColor="#7C95FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rc-av" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A3D" /><stop offset="1" stopColor="#FF5A00" />
        </linearGradient>
        <linearGradient id="rc-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FF8A3D" /><stop offset="1" stopColor="#FF5A00" />
        </linearGradient>
        <clipPath id="rc-avclip"><circle cx={AV.cx} cy={AV.cy} r={AV.r} /></clipPath>
        <pattern id="rc-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#94A3B8" fillOpacity=".14" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#rc-bg)" />
      <rect width={W} height={H} fill="url(#rc-glow)" />
      <path d="M840 0h360v310H840z" fill="url(#rc-dots)" opacity=".55" />
      <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="28" fill="none" stroke="#94A3B8" strokeOpacity=".2" strokeWidth="3" />

      {/* brand */}
      {assets
        ? <image href={assets.logo} x="60" y="44" width="210" height="60" preserveAspectRatio="xMinYMid meet" />
        : <text x="64" y="84" fill="#FF5A00" fontSize="22" fontWeight="700" letterSpacing="3">TRACK MY ROADMAP</text>}
      <rect x="975" y="50" width="161" height="42" rx="21" fill="#17243A" stroke="#3B4B68" />
      <circle cx="998" cy="71" r="5" fill="#FF7130" />
      <text x="1013" y="77" fill="#D6DEEB" fontSize="15" fontWeight="700" letterSpacing="1.5">ROAD CARD</text>

      {/* person */}
      <circle cx={AV.cx} cy={AV.cy} r={AV.r + 7} fill="#111A2C" stroke="#FF7130" strokeOpacity=".8" strokeWidth="2" />
      {assets?.avatar ? (
        <image href={assets.avatar} x={AV.cx - AV.r} y={AV.cy - AV.r} width={AV.r * 2} height={AV.r * 2} clipPath="url(#rc-avclip)" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <>
          <circle cx={AV.cx} cy={AV.cy} r={AV.r} fill="url(#rc-av)" />
          <text x={AV.cx} y={AV.cy + 17} fill="#fff" fontSize="46" fontWeight="700" textAnchor="middle">{a.profile.initials || "?"}</text>
        </>
      )}
      <text x="202" y="198" fill="#F8FAFC" fontSize="42" fontWeight="700" letterSpacing="-1">{clip(a.profile.name, 20)}</text>
      <text x="202" y="237" fill="#AAB8CC" fontSize="20">{since ? `Learning since ${since}` : "Learning on Track My Roadmap"}</text>
      <rect x="202" y="258" width="176" height="30" rx="15" fill="#203149" />
      <circle cx="220" cy="273" r="4" fill="#43D399" />
      <text x="232" y="278" fill="#C5D2E2" fontSize="12" fontWeight="700" letterSpacing="1.1">LEARNING IN PUBLIC</text>

      {/* stats */}
      <text x="64" y="333" fill="#AAB8CC" fontSize="14" fontWeight="700" letterSpacing="2">MILESTONES</text>
      <path d="M64 345h530" stroke="#40506A" strokeOpacity=".65" />
      {stats.map((s, i) => (
        <g key={s.l} transform={`translate(${64 + i * 136} 362)`}>
          <rect width="124" height="98" rx="16" fill="#17243A" stroke="#34445F" />
          <rect x="14" y="14" width="22" height="3" rx="1.5" fill="url(#rc-accent)" />
          <text x="14" y="57" fill="#F8FAFC" fontSize="34" fontWeight="700">{s.n}</text>
          <text x="14" y="81" fill="#AAB8CC" fontSize="14">{s.l}</text>
        </g>
      ))}

      {/* roadmaps */}
      <rect x="634" y="130" width="502" height="376" rx="25" fill="#151F32" stroke="#40506A" />
      <path d="M660 131h450" stroke="#FF7130" strokeOpacity=".7" strokeWidth="2" />
      <text x="666" y="176" fill="#F1F5F9" fontSize="17" fontWeight="700" letterSpacing="1.5">YOUR ROADMAPS</text>
      <text x="1104" y="176" fill="#8292AA" fontSize="13" textAnchor="end">{top.length ? `${top.length} IN FOCUS` : "START YOUR JOURNEY"}</text>
      <path d="M666 194h438" stroke="#35435A" />
      {top.length ? top.map((s, i) => {
        const y = 235 + i * 91;
        const color = s.pct >= 100 ? "#43D399" : "#8EA4FF";
        return (
          <g key={s.slug}>
            <circle cx="673" cy={y - 7} r="4" fill={color} />
            <text x="689" y={y} fill="#F1F5F9" fontSize="21" fontWeight="600">{clip(s.title, 24)}</text>
            <text x="1104" y={y} fill={color} fontSize="19" fontWeight="700" textAnchor="end">{s.pct}%</text>
            <rect x="689" y={y + 17} width="415" height="8" rx="4" fill="#29364B" />
            <rect x="689" y={y + 17} width={Math.max(8, 4.15 * s.pct)} height="8" rx="4" fill={color} />
          </g>
        );
      }) : (
        <>
          <circle cx="696" cy="252" r="22" fill="#22314A" />
          <path d="M691 252h10m-5-5v10" stroke="#FF8A3D" strokeWidth="2" strokeLinecap="round" />
          <text x="732" y="248" fill="#F1F5F9" fontSize="20" fontWeight="600">Your next chapter starts here</text>
          <text x="732" y="275" fill="#94A3B8" fontSize="15">Choose a roadmap and build momentum.</text>
        </>
      )}

      <text x="64" y="570" fill="#7E8DA5" fontSize="17" fontWeight="600">TRACKMYROADMAP.COM</text>
      <text x={W - 64} y="570" fill="#65758D" fontSize="14" textAnchor="end" letterSpacing="1.4">SMALL STEPS. REAL PROGRESS.</text>
    </svg>
  );
}

/* ---------- one roadmap's card (same layout as the shared image in app/card/[token]/image) ---------- */

function RoadmapCardSvg({ a, s, assets, ref }: { a: AccountData; s: RoadmapStat; assets: Assets | null; ref: React.Ref<SVGSVGElement> }) {
  const W = 1200, H = 630;
  const since = a.profile.joined ? new Date(a.profile.joined).toLocaleDateString("en", { month: "short", year: "numeric" }) : "";
  const finished = s.pct >= 100;
  const accent = finished ? "#43D399" : "#8EA4FF";
  const states = s.phaseStates.split("");
  const n = states.length;
  const X0 = 80, X1 = 1120, LY = 500;
  const xAt = (i: number) => (n <= 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) * i) / (n - 1));
  const curIdx = states.findIndex((x) => x !== "d");
  const title = clip(s.title, 26);
  const pill = s.category === "Skill" ? "SKILL" : "CAREER PATH";
  const eyebrow = finished ? "COMPLETED THE ROADMAP" : "IS LEARNING";
  const eyebrowW = eyebrow.length * 11.6; // 14px bold, 2px letter spacing
  const pillW = 30 + pill.length * 8.9;
  const AV = { cx: 104, cy: 84, r: 40 };
  const RC = { cx: 1016, cy: 290, r: 96 }, CIRC = 2 * Math.PI * RC.r;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.title} Road Card for ${a.profile.name}: ${s.pct}% complete`} className="block h-auto w-full"
      style={{ fontFamily: "var(--display), system-ui, sans-serif" }}>
      <defs>
        <linearGradient id="rm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#111B31" /><stop offset=".55" stopColor="#0D172A" /><stop offset="1" stopColor="#0A1020" />
        </linearGradient>
        <radialGradient id="rm-glow" cx=".9" cy=".06" r=".72">
          <stop offset="0" stopColor="#7C95FF" stopOpacity=".28" /><stop offset="1" stopColor="#7C95FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rm-av" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A3D" /><stop offset="1" stopColor="#FF5A00" />
        </linearGradient>
        <clipPath id="rm-avclip"><circle cx={AV.cx} cy={AV.cy} r={AV.r} /></clipPath>
      </defs>
      <rect width={W} height={H} fill="url(#rm-bg)" />
      <rect width={W} height={H} fill="url(#rm-glow)" />
      <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="28" fill="none" stroke="#94A3B8" strokeOpacity=".2" strokeWidth="3" />

      {/* brand, top right */}
      {assets
        ? <image href={assets.logo} x={1136 - 210} y="54" width="210" height="60" preserveAspectRatio="xMaxYMid meet" />
        : <text x="1136" y="94" fill="#FF5A00" fontSize="22" fontWeight="700" letterSpacing="3" textAnchor="end">TRACK MY ROADMAP</text>}

      {/* person, top left */}
      <circle cx={AV.cx} cy={AV.cy} r={AV.r + 4} fill="#111A2C" stroke="#FF7130" strokeWidth="2" />
      {assets?.avatar ? (
        <image href={assets.avatar} x={AV.cx - AV.r} y={AV.cy - AV.r} width={AV.r * 2} height={AV.r * 2} clipPath="url(#rm-avclip)" preserveAspectRatio="xMidYMid slice" />
      ) : (
        <>
          <circle cx={AV.cx} cy={AV.cy} r={AV.r} fill="url(#rm-av)" />
          <text x={AV.cx} y={AV.cy + 11} fill="#fff" fontSize="32" fontWeight="700" textAnchor="middle">{a.profile.initials || "?"}</text>
        </>
      )}
      <text x="164" y="78" fill="#F1F5F9" fontSize="30" fontWeight="700">{clip(a.profile.name, 26)}</text>
      <text x="164" y="108" fill="#AAB8CC" fontSize="18">{since ? `Learning since ${since}` : "Learning on Track My Roadmap"}</text>

      {/* roadmap */}
      <text x="64" y="244" fill="#AAB8CC" fontSize="14" fontWeight="700" letterSpacing="2">{eyebrow}</text>
      <rect x={64 + eyebrowW + 10} y="225" width={pillW} height="26" rx="13" fill="#17243A" stroke="#3B4B68" />
      <circle cx={64 + eyebrowW + 24} cy="238" r="4" fill="#FF7130" />
      <text x={64 + eyebrowW + 34} y="243" fill="#D6DEEB" fontSize="12" fontWeight="700" letterSpacing="1.2">{pill}</text>
      <text x="64" y="306" fill="#F1F5F9" fontSize={title.length > 18 ? 48 : 58} fontWeight="700" letterSpacing="-1">{title}</text>
      <text x="64" y="350" fill={finished ? "#43D399" : "#C5D2E2"} fontSize="21">
        {finished ? "Every phase done ✓" : s.current ? `Now on Phase ${s.current.num} of ${n} · ${clip(s.current.title, 34)}` : ""}
      </text>
      <text x="64" y="384" fill="#8292AA" fontSize="17">{`${s.done} of ${s.total} topics · ${s.phasesDone} of ${n} phases`}</text>

      {/* ring */}
      <circle cx={RC.cx} cy={RC.cy} r={RC.r} fill="#151F32" stroke="#29364B" strokeWidth="18" />
      <circle cx={RC.cx} cy={RC.cy} r={RC.r} fill="none" stroke={accent} strokeWidth="18" strokeLinecap="round"
        strokeDasharray={`${(CIRC * Math.max(s.pct, 1)) / 100} ${CIRC}`} transform={`rotate(-90 ${RC.cx} ${RC.cy})`} />
      <text x={RC.cx} y={RC.cy + 14} fill={accent} fontSize="60" fontWeight="700" textAnchor="middle">{s.pct}%</text>
      <text x={RC.cx} y={RC.cy + 44} fill="#AAB8CC" fontSize="16" textAnchor="middle">complete</text>

      {/* one stop per phase */}
      <line x1={X0} y1={LY} x2={X1} y2={LY} stroke="#2B3A52" strokeWidth="6" strokeLinecap="round" />
      {states.map((st, i) => (i < n - 1 && st === "d" ? <line key={"l" + i} x1={xAt(i)} y1={LY} x2={xAt(i + 1)} y2={LY} stroke="#43D399" strokeWidth="6" /> : null))}
      {states.map((st, i) => st === "d"
        ? <circle key={i} cx={xAt(i)} cy={LY} r="11" fill="#43D399" />
        : i === curIdx
          ? <circle key={i} cx={xAt(i)} cy={LY} r="13" fill="#0D172A" stroke="#FF7130" strokeWidth="5" />
          : <circle key={i} cx={xAt(i)} cy={LY} r="10" fill="#0D172A" stroke={st === "s" ? "#FF9A5C" : "#475569"} strokeWidth="3" />)}
      <text x="64" y="538" fill="#8292AA" fontSize="14">Phase 1</text>
      <text x={W - 64} y="538" fill="#8292AA" fontSize="14" textAnchor="end">{`Phase ${n}`}</text>

      <text x="64" y="582" fill="#7E8DA5" fontSize="16" fontWeight="600" letterSpacing="1">TRACKMYROADMAP.COM</text>
      <text x={W - 64} y="582" fill="#65758D" fontSize="13" textAnchor="end" letterSpacing="1.4">SMALL STEPS. REAL PROGRESS.</text>
    </svg>
  );
}
