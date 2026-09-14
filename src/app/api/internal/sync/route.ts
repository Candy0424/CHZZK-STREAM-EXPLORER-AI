import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getLiveEnv, isDemoMode } from "@/lib/env";
import { ChzzkClient } from "@/lib/chzzk-client";
import { createSyncRepository } from "@/lib/sync-repository";
import { syncLives } from "@/lib/sync-lives";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") ?? "";
  const bearer = `Bearer ${expected}`;
  if (
    !expected ||
    Buffer.byteLength(actual) !== Buffer.byteLength(bearer) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(bearer))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode())
    return NextResponse.json(
      { error: "샘플 모드에서는 공식 동기화를 실행할 수 없습니다." },
      { status: 409 },
    );
  try {
    const env = getLiveEnv();
    const result = await syncLives(
      createSyncRepository(env.SYNC_INTERVAL_MINUTES),
      new ChzzkClient({ clientId: env.CHZZK_CLIENT_ID, clientSecret: env.CHZZK_CLIENT_SECRET }),
      env.SYNC_MAX_PAGES,
    );
    revalidateTag("streamers", { expire: 0 });
    return NextResponse.json(result, {
      status:
        result.status === "FAILED"
          ? 502
          : result.status === "LOCKED"
            ? 409
            : result.status === "COOLDOWN"
              ? 429
              : 200,
    });
  } catch {
    return NextResponse.json(
      { error: "동기화를 시작할 수 없습니다. 서버 설정을 확인해 주세요." },
      { status: 503 },
    );
  }
}
