import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { channels, currentLives, liveHistory, syncRuns } from "../src/lib/schema";
import { applyCompleteSnapshot, type SnapshotTransaction } from "../src/lib/sync-repository";
import { live, channelA, channelB, channelC } from "./fixtures";
const pg = new PGlite();
const db = drizzle(pg);
const now = new Date("2026-09-14T12:00:00Z");
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => {
  await pg.close();
});
describe("PostgreSQL snapshot transaction", () => {
  it("atomically transitions missing channels offline and preserves visibility/history", async () => {
    await db.insert(channels).values([
      { channelId: channelA, channelName: "A", status: "ONLINE", isVisible: false },
      { channelId: channelB, channelName: "B", status: "ONLINE" },
    ]);
    await db
      .insert(syncRuns)
      .values({ id: "run-1", status: "RUNNING", startedAt: now.toISOString() });
    await db.transaction((tx) =>
      applyCompleteSnapshot(
        tx as unknown as SnapshotTransaction,
        "run-1",
        [live(channelA, 101), live(channelC, 103)],
        2,
        now,
      ),
    );
    const rows = await db.select().from(channels);
    expect(rows.find((row) => row.channelId === channelB)?.status).toBe("OFFLINE");
    expect(rows.find((row) => row.channelId === channelA)?.isVisible).toBe(false);
    expect(rows.find((row) => row.channelId === channelC)?.status).toBe("ONLINE");
    expect(await db.select().from(currentLives)).toHaveLength(2);
    expect(await db.select().from(liveHistory)).toHaveLength(2);
    expect((await db.select().from(syncRuns))[0]).toMatchObject({
      status: "COMPLETE",
      newChannelCount: 1,
      pageCount: 2,
    });
  });
  it("rolls back every state change after a transaction fails", async () => {
    const beforeChannels = await db.select().from(channels);
    const beforeLives = await db.select().from(currentLives);
    await db
      .insert(syncRuns)
      .values({ id: "run-2", status: "RUNNING", startedAt: now.toISOString() });
    await expect(
      db.transaction(async (tx) => {
        await applyCompleteSnapshot(
          tx as unknown as SnapshotTransaction,
          "run-2",
          [live(channelB, 102)],
          1,
          now,
        );
        throw new Error("Simulated storage failure");
      }),
    ).rejects.toThrow("Simulated storage failure");
    expect(await db.select().from(channels)).toEqual(beforeChannels);
    expect(await db.select().from(currentLives)).toEqual(beforeLives);
    expect((await db.select().from(syncRuns).where(eq(syncRuns.id, "run-2")))[0].status).toBe(
      "RUNNING",
    );
  });
  it("removes ended current lives but retains the last broadcast in history", async () => {
    await db
      .insert(syncRuns)
      .values({ id: "run-3", status: "RUNNING", startedAt: now.toISOString() });
    await db.transaction((tx) =>
      applyCompleteSnapshot(tx as unknown as SnapshotTransaction, "run-3", [], 1, now),
    );
    expect(await db.select().from(currentLives)).toHaveLength(0);
    expect(await db.select().from(liveHistory)).toHaveLength(2);
    expect((await db.select().from(channels)).every((row) => row.status === "OFFLINE")).toBe(true);
  });
});
