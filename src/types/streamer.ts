export type ChannelStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";
export type CategoryType = "GAME" | "SPORTS" | "ETC";
export interface Streamer {
  channelId: string;
  channelName: string;
  channelImageUrl: string | null;
  verifiedMark: boolean;
  status: ChannelStatus;
  liveTitle: string;
  thumbnailUrl: string | null;
  viewerCount: number;
  openDate: string | null;
  adult: boolean;
  categoryType: CategoryType;
  categoryId: string;
  categoryName: string;
  tags: string[];
  lastCheckedAt: string | null;
  lastSeenLiveAt: string | null;
  demo?: boolean;
}
export interface Snapshot {
  streamers: Streamer[];
  lastSuccessfulSync: string | null;
  lastAttemptFailed: boolean;
  mode: "demo" | "live";
}
export interface StreamerResponse {
  items: Streamer[];
  total: number;
  counts: { all: number; online: number; offline: number; unknown: number; delayed: number };
  categories: { id: string; name: string; count: number }[];
  lastSuccessfulSync: string | null;
  freshness: "fresh" | "aging" | "stale";
  mode: "demo" | "live";
  page: number;
  pageSize: number;
  nextPage: number | null;
  totalViewers: number;
}
