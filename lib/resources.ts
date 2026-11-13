/* Recommended YouTube videos, playlists and channels per roadmap topic (table: topic_resources). */
import type { ResourceKind } from "@/lib/youtube";

export type TopicResource = {
  id: string;
  roadmap: string;
  topic_key: string;
  kind: ResourceKind;
  url: string;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  note: string | null;
  position: number;
};

/** Topic key → its resources, in display order. */
export type ResourceMap = Record<string, TopicResource[]>;

export const RESOURCE_COLUMNS = "id, roadmap, topic_key, kind, url, title, channel, thumbnail, note, position";

export function byPosition(a: TopicResource, b: TopicResource) {
  return a.position - b.position || a.title.localeCompare(b.title);
}

export function groupByTopic(rows: TopicResource[]): ResourceMap {
  const map: ResourceMap = {};
  for (const r of rows) (map[r.topic_key] ??= []).push(r);
  for (const k in map) map[k].sort(byPosition);
  return map;
}
