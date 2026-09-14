import type { Live } from "../src/lib/chzzk-client";
export const channelA = "a".repeat(32);
export const channelB = "b".repeat(32);
export const channelC = "c".repeat(32);
export function live(channelId = channelA, liveId = 100): Live {
  return {
    liveId,
    channelId,
    channelName: "테스트 방송인",
    channelImageUrl: null,
    liveTitle: "오늘의 테스트 방송",
    liveThumbnailImageUrl: null,
    concurrentUserCount: 1200,
    openDate: "2026-09-14T10:00:00+09:00",
    adult: false,
    tags: ["소통"],
    categoryType: "GAME",
    liveCategory: "test-game",
    liveCategoryValue: "테스트 게임",
  };
}
