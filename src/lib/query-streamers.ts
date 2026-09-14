import { z } from "zod";
import type { Snapshot, StreamerResponse } from "@/types/streamer";
export const querySchema = z.object({
  status: z.enum(["all", "online", "offline", "unknown", "delayed"]).default("all"),
  query: z.string().max(100).default(""),
  category: z.enum(["all", "GAME", "SPORTS", "ETC"]).default("all"),
  categoryId: z.string().max(100).default(""),
  tag: z.string().max(50).default(""),
  sort: z.enum(["viewers_desc", "started_desc", "name_asc"]).default("viewers_desc"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  ids: z.string().max(3300).optional(),
});
export type StreamerQuery = z.infer<typeof querySchema>;
export function queryStreamers(
  snapshot: Snapshot,
  query: StreamerQuery,
  now = Date.now(),
): StreamerResponse {
  const age = snapshot.lastSuccessfulSync
    ? now - Date.parse(snapshot.lastSuccessfulSync)
    : Infinity;
  const freshness =
    snapshot.lastAttemptFailed || age > 15 * 60000 ? "stale" : age > 5 * 60000 ? "aging" : "fresh";
  const all = snapshot.streamers;
  const ids = query.ids !== undefined ? new Set(query.ids.split(",")) : null;
  const text = query.query.trim().toLocaleLowerCase("ko");
  const items = all
    .filter((channel) => {
      return (
        (!ids || ids.has(channel.channelId)) &&
        (query.status === "all" ||
          (query.status === "delayed"
            ? freshness !== "fresh" || channel.status === "UNKNOWN"
            : channel.status.toLowerCase() === query.status)) &&
        (query.category === "all" || channel.categoryType === query.category) &&
        (!query.categoryId || channel.categoryId === query.categoryId) &&
        (!query.tag || channel.tags.some((tag) => tag.toLowerCase() === query.tag.toLowerCase())) &&
        (!text ||
          [channel.channelName, channel.liveTitle, channel.categoryName, ...channel.tags]
            .join(" ")
            .toLocaleLowerCase("ko")
            .includes(text))
      );
    })
    .sort((a, b) => {
      const rank = { ONLINE: 0, UNKNOWN: 1, OFFLINE: 2 };
      const statusOrder = rank[a.status] - rank[b.status];
      if (statusOrder) return statusOrder;
      const value =
        query.sort === "name_asc"
          ? a.channelName.localeCompare(b.channelName, "ko")
          : query.sort === "started_desc"
            ? Date.parse(b.openDate || "1970-01-01") - Date.parse(a.openDate || "1970-01-01")
            : b.viewerCount - a.viewerCount;
      return value || a.channelId.localeCompare(b.channelId);
    });
  const categories = new Map<string, { id: string; name: string; count: number }>();
  all
    .filter((channel) => channel.status === "ONLINE")
    .forEach((channel) => {
      const entry = categories.get(channel.categoryId) ?? {
        id: channel.categoryId,
        name: channel.categoryName,
        count: 0,
      };
      entry.count++;
      categories.set(entry.id, entry);
    });
  const start = (query.page - 1) * query.pageSize;
  return {
    items: items.slice(start, start + query.pageSize),
    total: items.length,
    counts: {
      all: all.length,
      online: all.filter((c) => c.status === "ONLINE").length,
      offline: all.filter((c) => c.status === "OFFLINE").length,
      unknown: all.filter((c) => c.status === "UNKNOWN").length,
      delayed:
        freshness === "fresh" ? all.filter((c) => c.status === "UNKNOWN").length : all.length,
    },
    categories: [...categories.values()].sort((a, b) => b.count - a.count),
    lastSuccessfulSync: snapshot.lastSuccessfulSync,
    freshness,
    mode: snapshot.mode,
    page: query.page,
    pageSize: query.pageSize,
    nextPage: start + query.pageSize < items.length ? query.page + 1 : null,
    totalViewers: all.reduce((sum, c) => sum + (c.status === "ONLINE" ? c.viewerCount : 0), 0),
  };
}
