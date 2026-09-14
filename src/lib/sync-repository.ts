import { desc, eq, sql } from "drizzle-orm";
import { getDb, getSql } from "./database";
import { channels, currentLives, liveHistory, syncRuns } from "./schema";
import type { Live } from "./chzzk-client";
import type { SyncRepository } from "./sync-lives";
export type SnapshotTransaction = Pick<
  ReturnType<typeof getDb>,
  "insert" | "update" | "delete" | "select" | "execute"
>;

// This function must run inside a transaction. No network requests occur here.
export async function applyCompleteSnapshot(
  tx: SnapshotTransaction,
  id: string,
  lives: Live[],
  pageCount: number,
  now: Date,
) {
  const at = now.toISOString();
  const existing = new Set(
    (await tx.select({ id: channels.channelId }).from(channels)).map((row) => row.id),
  );
  await tx.delete(currentLives);
  await tx.update(channels).set({ status: "OFFLINE", lastCheckedAt: at, updatedAt: at });
  let newChannelCount = 0;
  // Batches avoid PostgreSQL's parameter limit for large catalogs.
  for (let offset = 0; offset < lives.length; offset += 100) {
    const batch = lives.slice(offset, offset + 100);
    newChannelCount += batch.filter((live) => !existing.has(live.channelId)).length;
    await tx
      .insert(channels)
      .values(
        batch.map((live) => ({
          channelId: live.channelId,
          channelName: live.channelName,
          channelImageUrl: live.channelImageUrl,
          status: "ONLINE" as const,
          lastSeenLiveAt: at,
          lastCheckedAt: at,
          updatedAt: at,
        })),
      )
      .onConflictDoUpdate({
        target: channels.channelId,
        set: {
          channelName: sql`excluded.channel_name`,
          channelImageUrl: sql`excluded.channel_image_url`,
          status: "ONLINE",
          lastSeenLiveAt: at,
          lastCheckedAt: at,
          updatedAt: at,
          needsReview: false,
        },
      });
    await tx.insert(currentLives).values(
      batch.map((live) => ({
        channelId: live.channelId,
        liveId: String(live.liveId),
        liveTitle: live.liveTitle,
        thumbnailUrl: live.liveThumbnailImageUrl,
        viewerCount: live.concurrentUserCount,
        openDate: live.openDate,
        adult: live.adult,
        categoryType: live.categoryType,
        categoryId: live.liveCategory,
        categoryName: live.liveCategoryValue,
        tags: live.tags,
        syncRunId: id,
      })),
    );
    await tx
      .insert(liveHistory)
      .values(
        batch.map((live) => ({
          liveId: String(live.liveId),
          channelId: live.channelId,
          lastTitle: live.liveTitle,
          lastCategoryName: live.liveCategoryValue,
          categoryType: live.categoryType,
          categoryId: live.liveCategory,
          startedAt: live.openDate,
          lastSeenAt: at,
        })),
      )
      .onConflictDoUpdate({
        target: liveHistory.liveId,
        set: {
          lastTitle: sql`excluded.last_title`,
          lastCategoryName: sql`excluded.last_category_name`,
          categoryType: sql`excluded.category_type`,
          categoryId: sql`excluded.category_id`,
          lastSeenAt: at,
        },
      });
  }
  await tx
    .update(syncRuns)
    .set({
      status: "COMPLETE",
      completedAt: at,
      pageCount,
      liveCount: lives.length,
      newChannelCount,
    })
    .where(eq(syncRuns.id, id));
  return newChannelCount;
}

export function createSyncRepository(minIntervalMinutes = 5): SyncRepository {
  const db = getDb();
  return {
    async withLock(callback) {
      // Dedicated session owns the advisory lock through collection + commit.
      // It is automatically released by PostgreSQL if the process disconnects.
      const connection = await getSql().reserve();
      try {
        const [result] = await connection`select pg_try_advisory_lock(732061409) as acquired`;
        if (!result.acquired) return null;
        try {
          return await callback();
        } finally {
          await connection`select pg_advisory_unlock(732061409)`;
        }
      } finally {
        connection.release();
      }
    },
    async isCoolingDown(now) {
      const [last] = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);
      if (!last) return false;
      return (
        Boolean(last.retryAt && Date.parse(last.retryAt) > now.getTime()) ||
        now.getTime() - Date.parse(last.startedAt) < minIntervalMinutes * 60000
      );
    },
    async start(id, now) {
      // With the lock acquired, a previous RUNNING row belongs to an interrupted process.
      await db
        .update(syncRuns)
        .set({
          status: "FAILED",
          completedAt: now.toISOString(),
          errorCode: "INTERRUPTED",
          errorMessage: "이전 동기화 실행이 중단되었습니다.",
        })
        .where(eq(syncRuns.status, "RUNNING"));
      await db.insert(syncRuns).values({ id, status: "RUNNING", startedAt: now.toISOString() });
    },
    async commit(id, lives, pageCount, now) {
      return db.transaction((tx) => applyCompleteSnapshot(tx, id, lives, pageCount, now));
    },
    async fail(id, code, message, pageCount, now, retryAfterSeconds) {
      await db
        .update(syncRuns)
        .set({
          status: "FAILED",
          completedAt: now.toISOString(),
          errorCode: code,
          errorMessage: message,
          pageCount,
          retryAt: retryAfterSeconds
            ? new Date(now.getTime() + retryAfterSeconds * 1000).toISOString()
            : null,
        })
        .where(eq(syncRuns.id, id));
    },
  };
}
