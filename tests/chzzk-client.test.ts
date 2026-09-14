import { describe, it, expect, vi } from "vitest";
import { ChzzkClient } from "../src/lib/chzzk-client";
import { live, channelA, channelB } from "./fixtures";
const credentials = { clientId: "fixture-client", clientSecret: "fixture-secret" };
const ok = (content: unknown) =>
  new Response(JSON.stringify({ code: 200, message: null, content }));
describe("official API client", () => {
  it("keeps uncategorized broadcasts returned with null category fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      ok({
        data: [
          live(),
          { ...live(channelB), categoryType: null, liveCategory: null, liveCategoryValue: "" },
        ],
        page: { next: "more-broadcasts" },
      }),
    );
    const page = await new ChzzkClient(credentials, fetcher).getLivePage();
    expect(page.data).toHaveLength(2);
    expect(page.data[1]).toMatchObject({
      channelId: channelB,
      categoryType: "ETC",
      liveCategory: "",
      liveCategoryValue: "미분류",
    });
    expect(page.page.next).toBe("more-broadcasts");
  });
  it.each(["ENTERTAINMENT", "FUTURE_CATEGORY"])(
    "preserves broadcasts with the API category type %s",
    async (categoryType) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          ok({
            data: [{ ...live(), categoryType, liveCategory: "talk", liveCategoryValue: "토크" }],
            page: {},
          }),
        );
      const page = await new ChzzkClient(credentials, fetcher).getLivePage();
      expect(page.data[0]).toMatchObject({
        categoryType: "ETC",
        liveCategory: "talk",
        liveCategoryValue: "토크",
      });
    },
  );
  it("still rejects category fields with an invalid data type", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(ok({ data: [{ ...live(), categoryType: { invalid: true } }], page: {} }));
    await expect(new ChzzkClient(credentials, fetcher).getLivePage()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("uses client headers, preserves cursors and normalizes timezone-less KST", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        ok({ data: [{ ...live(), openDate: "2026-09-14 10:00:00" }], page: { next: "next+/=" } }),
      );
    const result = await new ChzzkClient(credentials, fetcher).getLivePage("cursor+/=");
    expect(result.data[0].openDate).toBe("2026-09-14T10:00:00+09:00");
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get("next")).toBe("cursor+/=");
    expect(options?.headers).toEqual({
      "Client-Id": "fixture-client",
      "Client-Secret": "fixture-secret",
    });
    expect(options?.redirect).toBe("error");
  });
  it.each([401, 403, 404])(
    "does not retry HTTP %s or echo an upstream error body",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("private upstream body", { status }));
      await expect(new ChzzkClient(credentials, fetcher).getLivePage()).rejects.toMatchObject({
        code: String(status),
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("stops on 429 and preserves a safe cooldown", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "900" } }));
    const sleep = vi.fn();
    await expect(new ChzzkClient(credentials, fetcher, sleep).getLivePage()).rejects.toMatchObject({
      code: "429",
      retryAfterSeconds: 900,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("retries 500 at most twice, with backoff", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 500 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(new ChzzkClient(credentials, fetcher, sleep).getLivePage()).rejects.toMatchObject({
      code: "500",
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });
  it("does not accept a malformed page as an empty successful snapshot", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => ok({ data: [] }));
    await expect(new ChzzkClient(credentials, fetcher).getLivePage()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("rejects invalid channel IDs and impossible start dates", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        ok({ data: [{ ...live(), channelId: "../somewhere", openDate: "not-a-date" }], page: {} }),
      );
    await expect(new ChzzkClient(credentials, fetcher).getLivePage()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("fetches channels in batches of 20 and reports omitted IDs", async () => {
    const ids = Array.from({ length: 21 }, (_, i) => (i + 1).toString(16).padStart(32, "0"));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => ok({ data: [] }));
    const result = await new ChzzkClient(credentials, fetcher).getChannels(ids);
    expect(result.missing).toEqual(ids);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.getAll("channelIds"),
    ).toHaveLength(20);
    expect(
      new URL(String(fetcher.mock.calls[1][0])).searchParams.getAll("channelIds"),
    ).toHaveLength(1);
  });
  it("deduplicates channel metadata requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      ok({
        data: [
          {
            channelId: channelA,
            channelName: "테스트",
            channelImageUrl: null,
            followerCount: 1,
            verifiedMark: true,
          },
        ],
      }),
    );
    const result = await new ChzzkClient(credentials, fetcher).getChannels([
      channelA,
      channelA,
      channelB,
    ]);
    expect(result.missing).toEqual([channelB]);
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.getAll("channelIds"),
    ).toHaveLength(2);
  });
});
