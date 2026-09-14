import { randomUUID } from "node:crypto";
import { ChzzkError, type ChzzkClient, type Live } from "./chzzk-client";
export interface SyncRepository {
  withLock<T>(callback: () => Promise<T>): Promise<T | null>;
  isCoolingDown(now: Date): Promise<boolean>;
  start(id: string, now: Date): Promise<void>;
  commit(id: string, lives: Live[], pageCount: number, now: Date): Promise<number>;
  fail(
    id: string,
    code: string,
    message: string,
    pageCount: number,
    now: Date,
    retryAfterSeconds?: number,
  ): Promise<void>;
}
export async function syncLives(
  repository: SyncRepository,
  client: Pick<ChzzkClient, "getLivePage">,
  maxPages = 1000,
) {
  const result = await repository.withLock(async () => {
    if (await repository.isCoolingDown(new Date())) return { status: "COOLDOWN" as const };
    const id = randomUUID();
    await repository.start(id, new Date());
    let pageCount = 0;
    try {
      const lives = new Map<string, Live>();
      const cursors = new Set<string>();
      let next: string | undefined;
      do {
        if (pageCount >= maxPages)
          throw new ChzzkError("PAGE_LIMIT", "안전한 전체 순회 한도를 초과했습니다.");
        const page = await client.getLivePage(next);
        pageCount++;
        for (const live of page.data)
          if (!lives.has(live.channelId)) lives.set(live.channelId, live);
        next = page.page.next || undefined;
        if (next && cursors.has(next))
          throw new ChzzkError("CURSOR_LOOP", "반복되는 커서를 감지했습니다.");
        if (next) cursors.add(next);
      } while (next);
      const newChannelCount = await repository.commit(
        id,
        [...lives.values()],
        pageCount,
        new Date(),
      );
      return { status: "COMPLETE" as const, id, pageCount, liveCount: lives.size, newChannelCount };
    } catch (error) {
      // Never persist arbitrary exception strings: they may contain credentials or connection URLs.
      const code = error instanceof ChzzkError ? error.code : "SYNC_ERROR";
      const message =
        error instanceof ChzzkError
          ? error.message
          : "동기화 또는 저장에 실패했습니다. 기존 스냅샷을 유지합니다.";
      await repository.fail(
        id,
        code,
        message,
        pageCount,
        new Date(),
        error instanceof ChzzkError ? error.retryAfterSeconds : undefined,
      );
      return { status: "FAILED" as const, id, pageCount, errorCode: code };
    }
  });
  return result ?? { status: "LOCKED" as const };
}
