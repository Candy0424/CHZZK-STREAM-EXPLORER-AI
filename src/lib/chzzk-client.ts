import { z } from "zod";
import { CHANNEL_ID_PATTERN } from "./channel-url";
const id = z.string().regex(CHANNEL_ID_PATTERN);
const dateString = z
  .string()
  .transform((value) => {
    // The official API may send a timezone-less KST date.
    const normalized = value.replace(" ", "T");
    return /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}+09:00`;
  })
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid openDate");
export const liveSchema = z.object({
  liveId: z.number().int().positive(),
  channelId: id,
  channelName: z.string().min(1),
  channelImageUrl: z.string().nullable(),
  liveTitle: z.string(),
  liveThumbnailImageUrl: z.string().nullable(),
  concurrentUserCount: z.number().int().nonnegative(),
  openDate: dateString,
  adult: z.boolean(),
  tags: z.array(z.string()),
  // Live responses include null and newer types such as ENTERTAINMENT.
  // Preserve their category ID/name and group them under the app's ETC filter.
  categoryType: z
    .string()
    .nullable()
    .transform((value): "GAME" | "SPORTS" | "ETC" =>
      value === "GAME" || value === "SPORTS" ? value : "ETC",
    ),
  liveCategory: z
    .string()
    .nullable()
    .transform((value) => value ?? ""),
  liveCategoryValue: z
    .string()
    .nullable()
    .transform((value) => value || "미분류"),
});
const pageSchema = z.object({
  data: z.array(liveSchema),
  page: z.object({ next: z.string().nullish() }),
});
const channelSchema = z.object({
  channelId: id,
  channelName: z.string().min(1),
  channelImageUrl: z.string().nullable(),
  followerCount: z.number().int().nonnegative(),
  verifiedMark: z.boolean(),
});
export type Live = z.infer<typeof liveSchema>;
export type ChannelInfo = z.infer<typeof channelSchema>;
export class ChzzkError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export class ChzzkClient {
  constructor(
    private credentials: { clientId: string; clientSecret: string },
    private fetcher: typeof fetch = fetch,
    private sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}
  private async request(path: string, params: URLSearchParams): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(`https://openapi.chzzk.naver.com/open/v1/${path}?${params}`, {
          headers: {
            "Client-Id": this.credentials.clientId,
            "Client-Secret": this.credentials.clientSecret,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
      } catch {
        if (attempt < 2) {
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        throw new ChzzkError(
          "NETWORK_ERROR",
          "공식 API 연결 시간이 초과되었거나 연결에 실패했습니다.",
        );
      }
      if (response.status === 429) {
        const header = response.headers.get("retry-after");
        const seconds = header
          ? Number.isFinite(Number(header))
            ? Number(header)
            : (Date.parse(header) - Date.now()) / 1000
          : 300;
        throw new ChzzkError(
          "429",
          "공식 API 호출 한도를 초과했습니다. 다음 주기에 다시 시도합니다.",
          Math.max(300, Number.isFinite(seconds) ? seconds : 300),
        );
      }
      if (response.status >= 500 && attempt < 2) {
        await this.sleep(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok)
        throw new ChzzkError(
          String(response.status),
          `공식 API 요청 실패 (HTTP ${response.status})`,
        );
      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        throw new ChzzkError("INVALID_RESPONSE", "공식 API 응답을 읽을 수 없습니다.");
      }
      const envelope = z.object({ code: z.literal(200), content: z.unknown() }).safeParse(raw);
      if (!envelope.success)
        throw new ChzzkError("INVALID_RESPONSE", "공식 API 응답 형식이 변경되었습니다.");
      return envelope.data.content;
    }
    throw new ChzzkError("RETRY_EXHAUSTED", "공식 API 재시도 실패");
  }
  async getLivePage(next?: string) {
    const params = new URLSearchParams({ size: "20" });
    if (next) params.set("next", next);
    const result = pageSchema.safeParse(await this.request("lives", params));
    if (!result.success)
      throw new ChzzkError("INVALID_RESPONSE", "라이브 응답 형식 검증에 실패했습니다.");
    return result.data;
  }
  async getChannels(ids: string[]): Promise<{ channels: ChannelInfo[]; missing: string[] }> {
    const unique = [...new Set(ids)];
    if (unique.some((value) => !CHANNEL_ID_PATTERN.test(value)))
      throw new ChzzkError("INVALID_CHANNEL_ID", "채널 ID 형식이 올바르지 않습니다.");
    const channels: ChannelInfo[] = [];
    for (let offset = 0; offset < unique.length; offset += 20) {
      const params = new URLSearchParams();
      unique.slice(offset, offset + 20).forEach((value) => params.append("channelIds", value));
      const result = z
        .object({ data: z.array(channelSchema) })
        .safeParse(await this.request("channels", params));
      if (!result.success)
        throw new ChzzkError("INVALID_RESPONSE", "채널 응답 형식 검증에 실패했습니다.");
      channels.push(...result.data.data);
    }
    const found = new Set(channels.map((channel) => channel.channelId));
    return { channels, missing: unique.filter((value) => !found.has(value)) };
  }
}
