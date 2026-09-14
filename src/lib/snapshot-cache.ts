import type { Snapshot } from "@/types/streamer";

// Full catalogs exceed Next.js Data Cache's 2 MB entry limit. Keep one
// snapshot per process and share concurrent refreshes for at most 30 seconds.
export function createSnapshotCache(load: () => Promise<Snapshot>, ttlMs = 30000, now = Date.now) {
  let cached: Snapshot | undefined;
  let expiresAt = 0;
  let pending: Promise<Snapshot> | undefined;
  let generation = 0;
  return {
    get(): Promise<Snapshot> {
      if (cached && now() < expiresAt) return Promise.resolve(cached);
      if (pending) return pending;
      const version = generation;
      const request = Promise.resolve()
        .then(load)
        .then((snapshot) => {
          if (generation === version) {
            cached = snapshot;
            expiresAt = now() + ttlMs;
          }
          return snapshot;
        })
        .finally(() => {
          if (pending === request) pending = undefined;
        });
      pending = request;
      return request;
    },
    invalidate() {
      generation++;
      cached = undefined;
      expiresAt = 0;
      pending = undefined;
    },
  };
}
