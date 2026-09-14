import { describe, expect, it } from "vitest";
import { demoSnapshot } from "../src/lib/demo-data";
import { querySchema, queryStreamers } from "../src/lib/query-streamers";
import { channelUrl, safeImageUrl } from "../src/lib/channel-url";
const now = Date.parse("2026-09-14T12:00:00Z");
const snapshot = demoSnapshot(now);
describe("public catalog query", () => {
  it("puts online channels first and returns the 8/8 demo split", () => {
    const data = queryStreamers(snapshot, querySchema.parse({}), now);
    expect(data.counts).toEqual({ all: 16, online: 8, offline: 8, unknown: 0, delayed: 0 });
    expect(data.items.slice(0, 8).every((item) => item.status === "ONLINE")).toBe(true);
  });
  it("supports title, name, category and tag searches", () => {
    expect(
      queryStreamers(snapshot, querySchema.parse({ query: "모카" }), now).items[0].channelName,
    ).toBe("모카플레이");
    expect(
      queryStreamers(snapshot, querySchema.parse({ query: "피아노" }), now).items[0].channelName,
    ).toBe("여울");
    expect(
      queryStreamers(
        snapshot,
        querySchema.parse({ category: "GAME", tag: "힐링", status: "online" }),
        now,
      ).total,
    ).toBe(1);
  });
  it("supports empty favorites without leaking the whole catalog", () => {
    expect(queryStreamers(snapshot, querySchema.parse({ ids: "" }), now).total).toBe(0);
  });
  it("paginates deterministically and distinguishes catalog counts", () => {
    const result = queryStreamers(snapshot, querySchema.parse({ page: 2, pageSize: 3 }), now);
    expect(result.items).toHaveLength(3);
    expect(result.nextPage).toBe(3);
    expect(result.counts.all).toBe(16);
  });
  it("preserves statuses and marks stale after failed collection", () => {
    const result = queryStreamers(
      { ...snapshot, lastAttemptFailed: true },
      querySchema.parse({ status: "delayed" }),
      now,
    );
    expect(result.freshness).toBe("stale");
    expect(result.counts.delayed).toBe(16);
    expect(result.counts.online).toBe(8);
  });
  it.each([
    [4, "fresh"],
    [6, "aging"],
    [16, "stale"],
  ])("uses the %s minute freshness boundary", (minutes, freshness) => {
    expect(
      queryStreamers(
        { ...snapshot, lastSuccessfulSync: new Date(now - Number(minutes) * 60000).toISOString() },
        querySchema.parse({}),
        now,
      ).freshness,
    ).toBe(freshness);
  });
  it("rejects invalid pagination and query values", () => {
    expect(querySchema.safeParse({ page: "-1" }).success).toBe(false);
    expect(querySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(querySchema.safeParse({ sort: "sql" }).success).toBe(false);
  });
  it("never builds an arbitrary redirect or unsafe image URL", () => {
    expect(channelUrl("a".repeat(32))).toBe(`https://chzzk.naver.com/${"a".repeat(32)}`);
    expect(channelUrl("../../evil.com")).toBeNull();
    expect(channelUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("http://example.com/img")).toBeNull();
  });
});
