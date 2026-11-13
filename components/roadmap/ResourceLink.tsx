import type { TopicResource } from "@/lib/resources";
import { KIND_LABEL } from "@/lib/youtube";

/** A recommended YouTube video, playlist or channel: thumbnail, title, channel and the admin's note. Opens on YouTube. */
export function ResourceLink({ r, children }: { r: Pick<TopicResource, "kind" | "url" | "title" | "channel" | "thumbnail" | "note">; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-bg/60 p-2 pr-3">
      <a href={r.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true"
        className="relative grid aspect-video w-[112px] flex-none place-items-center overflow-hidden rounded-lg bg-sunk sm:w-[128px]">
        {r.thumbnail
          // eslint-disable-next-line @next/next/no-img-element -- small remote YouTube thumbnail, no resizing needed
          ? <img src={r.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          : <YouTubeMark size={30} />}
        {r.kind !== "video" && (
          <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1.5 py-px text-[.66rem] font-semibold text-white">{KIND_LABEL[r.kind]}</span>
        )}
      </a>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <a href={r.url} target="_blank" rel="noopener noreferrer"
          className="line-clamp-2 text-[.92rem] leading-snug font-semibold text-ink hover:text-route hover:underline">
          {r.title}<span className="vh"> (opens YouTube in a new tab)</span>
        </a>
        {r.channel && <span className="truncate text-[.8rem] text-muted">{r.channel}</span>}
        {r.note && <p className="m-0 text-[.82rem] leading-snug text-ink/80">{r.note}</p>}
        {children}
      </div>
    </div>
  );
}

export function YouTubeMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 28 20" aria-hidden="true" className={className}>
      <rect width="28" height="20" rx="5.5" fill="#FF0033" />
      <path d="M11.2 6v8l7-4-7-4Z" fill="#fff" />
    </svg>
  );
}
