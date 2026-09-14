import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshot";
import { querySchema, queryStreamers } from "@/lib/query-streamers";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success)
    return NextResponse.json({ error: "검색 조건이 올바르지 않습니다." }, { status: 400 });
  try {
    return NextResponse.json(queryStreamers(await getSnapshot(), query.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "방송 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}
