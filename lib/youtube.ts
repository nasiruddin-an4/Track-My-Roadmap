/*
 * YouTube links: turn whatever the admin pastes (watch, youtu.be, shorts, playlist, @handle…)
 * into one canonical URL, so the database only ever holds clean youtube.com links.
 */

export type ResourceKind = "video" | "playlist" | "channel";

export type ParsedYouTube = {
  kind: ResourceKind;
  /** canonical https://www.youtube.com/… link */
  url: string;
  /** video id, playlist id, or channel path (@handle, channel/UC…) */
  id: string;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const HANDLE = /^@[A-Za-z0-9._-]{3,30}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const LEGACY_NAME = /^[A-Za-z0-9._-]{1,100}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);

const video = (id: string): ParsedYouTube => ({ kind: "video", id, url: `https://www.youtube.com/watch?v=${id}` });
const playlist = (id: string): ParsedYouTube => ({ kind: "playlist", id, url: `https://www.youtube.com/playlist?list=${id}` });
const channel = (path: string): ParsedYouTube => ({ kind: "channel", id: path, url: `https://www.youtube.com/${path}` });

/** Parse a pasted YouTube link. A watch link that is part of a playlist stays a video unless `preferPlaylist`. */
export function parseYouTube(input: string, preferPlaylist = false): ParsedYouTube | null {
  let u: URL;
  try {
    const s = input.trim();
    u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const v = u.searchParams.get("v") ?? "";
  const list = u.searchParams.get("list") ?? "";

  if (host.endsWith("youtu.be")) return VIDEO_ID.test(parts[0] ?? "") ? video(parts[0]) : null;

  const [first = "", second = ""] = parts;
  if (first === "watch") {
    if (preferPlaylist && LIST_ID.test(list)) return playlist(list);
    if (VIDEO_ID.test(v)) return video(v);
    return LIST_ID.test(list) ? playlist(list) : null;
  }
  if (first === "playlist") return LIST_ID.test(list) ? playlist(list) : null;
  if (["shorts", "embed", "live", "v"].includes(first)) return VIDEO_ID.test(second) ? video(second) : null;
  if (HANDLE.test(decodeURIComponent(first))) return channel(decodeURIComponent(first));
  if (first === "channel" && CHANNEL_ID.test(second)) return channel(`channel/${second}`);
  if ((first === "c" || first === "user") && LEGACY_NAME.test(second)) return channel(`${first}/${second}`);
  return null;
}

/** Thumbnail for a video id, used when YouTube's info lookup gives none. */
export function videoThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** Only YouTube's own image hosts are kept as thumbnails. */
export function safeThumb(url: unknown): string | null {
  return typeof url === "string" && /^https:\/\/i[0-9]?\.ytimg\.com\//.test(url) && url.length <= 300 ? url : null;
}

export const KIND_LABEL: Record<ResourceKind, string> = { video: "Video", playlist: "Playlist", channel: "Channel" };
