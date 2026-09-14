import { describe, expect, it, vi } from "vitest";
import { createSnapshotCache } from "../src/lib/snapshot-cache";
import type { Snapshot } from "../src/types/streamer";
import { demoSnapshot } from "../src/lib/demo-data";

describe("server snapshot cache", () => {
  it("keeps a catalog larger than 2 MB and shares simultaneous database reads", async () => {
    const snapshot = demoSnapshot();
    snapshot.streamers = Array.from({ length: 6000 }, (_, i) => ({
      ...snapshot.streamers[i % snapshot.streamers.length],
    }));
    expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeGreaterThan(2 * 1024 * 1024);
    const load = vi.fn().mockResolvedValue(snapshot);
    const cache = createSnapshotCache(load);
    const results = await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(results.every((result) => result.streamers.length === 6000)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await cache.get()).toBe(snapshot);
  });
  it("reloads an empty initial catalog after the first sync and TTL", async () => {
    let now = 0;
    const empty = { ...demoSnapshot(), streamers: [] };
    const current = demoSnapshot();
    const load = vi.fn().mockResolvedValueOnce(empty).mockResolvedValueOnce(current);
    const cache = createSnapshotCache(load, 30000, () => now);
    expect((await cache.get()).streamers).toHaveLength(0);
    now = 30000;
    expect((await cache.get()).streamers.length).toBeGreaterThan(0);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not let a read from before invalidation replace a newer snapshot", async () => {
    let finishOld!: (snapshot: Snapshot) => void;
    const old = { ...demoSnapshot(), streamers: [] };
    const current = demoSnapshot();
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Snapshot>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce(current);
    const cache = createSnapshotCache(load);
    const pending = cache.get();
    await Promise.resolve();
    cache.invalidate();
    expect(await cache.get()).toBe(current);
    finishOld(old);
    await pending;
    expect(await cache.get()).toBe(current);
  });
  it("retries a failed database read instead of caching the failure", async () => {
    const current = demoSnapshot();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(current);
    const cache = createSnapshotCache(load);
    await expect(cache.get()).rejects.toThrow("database unavailable");
    expect(await cache.get()).toBe(current);
  });
});
