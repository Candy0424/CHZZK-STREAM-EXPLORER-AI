import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CHANNEL_ID_PATTERN } from "@/lib/channel-url";
const eventSchema = z.object({
  event: z.literal("channel_open"),
  channelId: z.string().regex(CHANNEL_ID_PATTERN),
});
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 512)
    return new NextResponse(null, { status: 413 });
  try {
    const body = await request.text();
    if (body.length > 512) return new NextResponse(null, { status: 413 });
    const event = eventSchema.safeParse(JSON.parse(body));
    if (!event.success) return new NextResponse(null, { status: 400 });
    console.info(JSON.stringify({ ...event.data, at: new Date().toISOString() }));
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
