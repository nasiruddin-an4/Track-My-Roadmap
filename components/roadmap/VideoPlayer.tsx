"use client";

/*
 * Watch a recommended video without leaving the tracker: a modal with YouTube's privacy-enhanced player.
 * Several videos for the same topic are listed under the player to switch between. Channels can't be
 * embedded, so they get a clear "open on YouTube" button instead. Closing the dialog unmounts the player,
 * which stops the video.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Close } from "@/components/icons";
import { YouTubeMark } from "@/components/roadmap/ResourceLink";
import type { TopicResource } from "@/lib/resources";
import { embedUrl, KIND_LABEL } from "@/lib/youtube";

export type WatchRequest = { topic: string; list: TopicResource[] };

export function VideoPlayer({ watch, onClose }: { watch: WatchRequest | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);

  // Layout effect, so its cleanup also runs when Next hides this page after you navigate away (pages stay in
  // the document): close the dialog, stop the video (a hidden iframe keeps playing) and release the scroll lock.
  useLayoutEffect(() => {
    const d = ref.current, root = document.documentElement;
    if (!d || !watch) return;
    if (!d.open) d.showModal();
    root.dataset.modal = "open";
    return () => {
      delete root.dataset.modal;
      d.querySelectorAll("iframe").forEach((f) => { f.src = "about:blank"; });
      if (d.open) d.close();
    };
  }, [watch]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="vp-title"
      // close on a click outside the panel, but not when a text selection inside it ends outside
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) e.currentTarget.close(); }}
      className="m-auto w-[min(960px,calc(100vw-24px))] max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      {/* keyed by topic so switching topics starts at the first video */}
      {watch && <Player key={watch.topic + watch.list[0]?.id} watch={watch} onClose={() => ref.current?.close()} />}
    </dialog>
  );
}

function Player({ watch, onClose }: { watch: WatchRequest; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const current = watch.list[index] ?? watch.list[0];
  if (!current) return null;
  const src = embedUrl(current.url);

  return (
    <div className="grid max-h-[calc(100svh-24px)] overflow-y-auto rounded-[20px] border border-line bg-surface shadow-[var(--shadow)]">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-[#FF0033]/10"><YouTubeMark size={18} /></span>
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="eyebrow">Recommended to learn</span>
          <h2 id="vp-title" className="m-0 truncate font-display text-[1.08rem] font-bold">{watch.topic}</h2>
        </span>
        <button type="button" onClick={onClose} aria-label="Close video" autoFocus
          className="grid size-10 flex-none place-items-center rounded-xl text-muted hover:bg-sunk hover:text-ink">
          <Close size={18} />
        </button>
      </header>

      {src ? (
        <div className="relative aspect-video w-full bg-black">
          <iframe key={current.id} src={src} title={current.title} className="absolute inset-0 size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        </div>
      ) : (
        <div className="grid aspect-video w-full place-items-center bg-bg p-6 text-center">
          <div className="grid justify-items-center gap-3">
            <YouTubeMark size={44} />
            <p className="m-0 max-w-[40ch] text-muted">
              <b className="text-ink">{current.channel || current.title}</b> is a YouTube channel. Channels open on YouTube.
            </p>
            <a href={current.url} target="_blank" rel="noopener noreferrer" className="btn primary">Open channel on YouTube ↗</a>
          </div>
        </div>
      )}

      <div className="grid gap-1.5 px-4 py-4 sm:px-5">
        <h3 className="m-0 text-[1.02rem] leading-snug font-bold">{current.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[.85rem] text-muted">
          {current.channel && <span>{current.channel}</span>}
          {current.kind !== "video" && <span className="rounded-md bg-sunk px-1.5 py-px text-[.75rem] font-semibold">{KIND_LABEL[current.kind]}</span>}
          {src && (
            <a href={current.url} target="_blank" rel="noopener noreferrer" className="ml-auto font-semibold text-route hover:underline">
              Not playing? Open on YouTube ↗
            </a>
          )}
        </div>
        {current.note && <p className="m-0 mt-1 rounded-xl bg-bg/60 px-3 py-2 text-[.9rem] leading-snug"><b className="text-highlight">Why this one: </b>{current.note}</p>}
      </div>

      {watch.list.length > 1 && (
        <nav aria-label={`More videos for ${watch.topic}`} className="border-t border-line px-4 py-4 sm:px-5">
          <span className="eyebrow">{watch.list.length} videos for this topic</span>
          <ol className="m-0 mt-2.5 grid list-none gap-2 p-0 sm:grid-cols-2">
            {watch.list.map((v, i) => (
              <li key={v.id}>
                <button type="button" onClick={() => setIndex(i)} aria-current={i === index ? "true" : undefined}
                  className={"flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors " + (i === index ? "border-route bg-route-soft" : "border-line bg-bg/50 hover:border-muted")}>
                  <span className="relative grid aspect-video w-24 flex-none place-items-center overflow-hidden rounded-lg bg-sunk">
                    {v.thumbnail
                      // eslint-disable-next-line @next/next/no-img-element -- small remote YouTube thumbnail
                      ? <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                      : <YouTubeMark size={22} />}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="line-clamp-2 text-[.86rem] leading-snug font-semibold">{v.title}</span>
                    <span className="truncate text-[.76rem] text-muted">{i === index ? "Now playing" : v.channel || KIND_LABEL[v.kind]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
