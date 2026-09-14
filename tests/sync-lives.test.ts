import { describe, expect, it, vi } from "vitest";
import { syncLives, type SyncRepository } from "../src/lib/sync-lives";
import { ChzzkError, type Live } from "../src/lib/chzzk-client";
import { live, channelA, channelB } from "./fixtures";
function repository() {
  let held = false;
  let saved = [live(channelB)];
  const repo: SyncRepository = {
    async withLock(callback) {
      if (held) return null;
      held = true;
      try {
        return await callback();
      } finally {
        held = false;
      }
    },
    isCoolingDown: vi.fn().mockResolvedValue(false),
    start: vi.fn(),
    fail: vi.fn(),
    commit: vi.fn(async (_id: string, data: Live[]) => {
      saved = data;
      return 1;
    }),
  };
  return { repo, snapshot: () => saved };
}
describe("complete live sync", () => {
  it("visits every page and deduplicates before committing once", async () => {
    const { repo, snapshot } = repository();
    const getLivePage = vi
      .fn()
      .mockResolvedValueOnce({ data: [live()], page: { next: "page-2" } })
      .mockResolvedValueOnce({ data: [live(), live(channelB, 200)], page: {} });
    const result = await syncLives(repo, { getLivePage });
    expect(result).toMatchObject({ status: "COMPLETE", pageCount: 2, liveCount: 2 });
    expect(getLivePage.mock.calls).toEqual([[undefined], ["page-2"]]);
    expect(repo.commit).toHaveBeenCalledTimes(1);
    expect(snapshot()).toHaveLength(2);
  });
  it("keeps the entire old snapshot when a later page fails", async () => {
    const { repo, snapshot } = repository();
    const before = structuredClone(snapshot());
    const getLivePage = vi
      .fn()
      .mockResolvedValueOnce({ data: [live(channelA)], page: { next: "page-2" } })
      .mockRejectedValueOnce(new ChzzkError("500", "API request failed"));
    expect(await syncLives(repo, { getLivePage })).toMatchObject({
      status: "FAILED",
      pageCount: 1,
    });
    expect(repo.commit).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
    expect(repo.fail).toHaveBeenCalledOnce();
  });
  it("rejects a cursor loop without declaring missing channels offline", async () => {
    const { repo } = repository();
    const getLivePage = vi.fn().mockResolvedValue({ data: [live()], page: { next: "same" } });
    expect(await syncLives(repo, { getLivePage })).toMatchObject({
      status: "FAILED",
      errorCode: "CURSOR_LOOP",
    });
    expect(repo.commit).not.toHaveBeenCalled();
  });
  it("rejects an incomplete collection at the configured page cap", async () => {
    const { repo } = repository();
    const getLivePage = vi.fn().mockResolvedValue({ data: [], page: { next: "more" } });
    expect(await syncLives(repo, { getLivePage }, 1)).toMatchObject({
      status: "FAILED",
      errorCode: "PAGE_LIMIT",
    });
    expect(repo.commit).not.toHaveBeenCalled();
  });
  it("accepts an explicitly successful empty final list", async () => {
    const { repo, snapshot } = repository();
    const getLivePage = vi.fn().mockResolvedValue({ data: [], page: {} });
    expect(await syncLives(repo, { getLivePage })).toMatchObject({
      status: "COMPLETE",
      liveCount: 0,
    });
    expect(snapshot()).toEqual([]);
  });
  it("blocks concurrent sync execution", async () => {
    const { repo } = repository();
    let finish!: (page: { data: Live[]; page: object }) => void;
    const getLivePage = vi.fn(
      () =>
        new Promise<{ data: Live[]; page: object }>((resolve) => {
          finish = resolve;
        }),
    );
    const first = syncLives(repo, { getLivePage });
    await vi.waitFor(() => expect(getLivePage).toHaveBeenCalledTimes(1));
    expect(await syncLives(repo, { getLivePage })).toEqual({ status: "LOCKED" });
    finish({ data: [], page: {} });
    await first;
  });
  it("honors cooldown without calling the API", async () => {
    const { repo } = repository();
    repo.isCoolingDown = vi.fn().mockResolvedValue(true);
    const getLivePage = vi.fn();
    expect(await syncLives(repo, { getLivePage })).toEqual({ status: "COOLDOWN" });
    expect(getLivePage).not.toHaveBeenCalled();
  });
  it("never puts database connection strings in persisted failure logs", async () => {
    const { repo } = repository();
    repo.commit = vi.fn().mockRejectedValue(new Error("postgres://private:password@host/db"));
    await syncLives(repo, { getLivePage: vi.fn().mockResolvedValue({ data: [], page: {} }) });
    expect(JSON.stringify(vi.mocked(repo.fail).mock.calls)).not.toContain("password");
  });
});
