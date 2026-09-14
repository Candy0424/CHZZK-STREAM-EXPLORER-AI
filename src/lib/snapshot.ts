import { desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "./database";
import { channels, currentLives, liveHistory, syncRuns } from "./schema";
import { isDemoMode } from "./env";
import { demoSnapshot } from "./demo-data";
import type { Snapshot } from "@/types/streamer";
const readDatabaseSnapshot = unstable_cache(
  async (): Promise<Snapshot> => {
    const db = getDb();
    // All reads see the same committed generation, even while a sync commits.
    return db.transaction(
      async (tx) => {
        const rows = await tx
          .select({ channel: channels, live: currentLives })
          .from(channels)
          .leftJoin(currentLives, eq(channels.channelId, currentLives.channelId))
          .where(eq(channels.isVisible, true));
        const history = await tx
          .selectDistinctOn([liveHistory.channelId])
          .from(liveHistory)
          .orderBy(liveHistory.channelId, desc(liveHistory.lastSeenAt));
        const historyMap = new Map(history.map((row) => [row.channelId, row]));
        const [success] = await tx
          .select()
          .from(syncRuns)
          .where(eq(syncRuns.status, "COMPLETE"))
          .orderBy(desc(syncRuns.completedAt))
          .limit(1);
        const [lastAttempt] = await tx
          .select()
          .from(syncRuns)
          .where(eq(syncRuns.status, "FAILED"))
          .orderBy(desc(syncRuns.startedAt))
          .limit(1);
        return {
          mode: "live",
          lastSuccessfulSync: success?.completedAt ?? null,
          lastAttemptFailed: Boolean(
            lastAttempt &&
            (!success || Date.parse(lastAttempt.startedAt) > Date.parse(success.startedAt)),
          ),
          streamers: rows.map(({ channel, live }) => {
            const previous = historyMap.get(channel.channelId);
            return {
              channelId: channel.channelId,
              channelName: channel.channelName,
              channelImageUrl: channel.channelImageUrl,
              verifiedMark: channel.verifiedMark,
              status: channel.status,
              liveTitle: live?.liveTitle ?? previous?.lastTitle ?? "아직 확인한 방송이 없습니다",
              thumbnailUrl: live?.thumbnailUrl ?? null,
              viewerCount: live?.viewerCount ?? 0,
              openDate: live?.openDate ?? previous?.startedAt ?? null,
              adult: live?.adult ?? false,
              categoryType: live?.categoryType ?? previous?.categoryType ?? "ETC",
              categoryId: live?.categoryId ?? previous?.categoryId ?? "",
              categoryName: live?.categoryName ?? previous?.lastCategoryName ?? "미분류",
              tags: live?.tags ?? [],
              lastCheckedAt: channel.lastCheckedAt,
              lastSeenLiveAt: channel.lastSeenLiveAt,
            };
          }),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },
  ["livescope-snapshot"],
  { revalidate: 30, tags: ["streamers"] },
);
export async function getSnapshot(): Promise<Snapshot> {
  return isDemoMode() ? demoSnapshot() : readDatabaseSnapshot();
}
