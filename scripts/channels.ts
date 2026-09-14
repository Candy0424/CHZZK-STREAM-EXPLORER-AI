import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, getSql } from "../src/lib/database";
import { getLiveEnv } from "../src/lib/env";
import { channels, syncRuns } from "../src/lib/schema";
import { ChzzkClient } from "../src/lib/chzzk-client";
import { CHANNEL_ID_PATTERN } from "../src/lib/channel-url";
config({ path: ".env.local", quiet: true });
async function main() {
  try {
    const [command, argument] = process.argv.slice(2);
    if (!["seed", "add", "hide", "show", "refresh", "logs", "review"].includes(command)) {
      console.log(
        "Usage: npm run channels -- seed|refresh|logs|review OR add|hide|show <channelId>",
      );
      return;
    }
    const db = getDb();
    if (command === "logs") {
      console.table(await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(10));
      return;
    }
    if (command === "review") {
      console.table(
        await db
          .select({ channelId: channels.channelId, channelName: channels.channelName })
          .from(channels)
          .where(eq(channels.needsReview, true)),
      );
      return;
    }
    if (command === "hide" || command === "show") {
      if (!CHANNEL_ID_PATTERN.test(argument ?? "")) throw new Error("Invalid channel ID");
      const result = await db
        .update(channels)
        .set({ isVisible: command === "show" })
        .where(eq(channels.channelId, argument))
        .returning({ id: channels.channelId });
      console.log(result.length ? "Channel visibility updated." : "Channel not found.");
      return;
    }
    let ids: string[];
    if (command === "seed") {
      const seed = z
        .array(
          z.object({ channelId: z.string().regex(CHANNEL_ID_PATTERN), source: z.string().min(1) }),
        )
        .parse(JSON.parse(await readFile("data/seed-channels.json", "utf8")));
      ids = seed.map((row) => row.channelId);
    } else if (command === "refresh")
      ids = (await db.select({ id: channels.channelId }).from(channels)).map((row) => row.id);
    else ids = [z.string().regex(CHANNEL_ID_PATTERN).parse(argument)];
    if (!ids.length) {
      console.log("No seed channels configured. Live sync automatically discovers channels.");
      return;
    }
    const env = getLiveEnv();
    const result = await new ChzzkClient({
      clientId: env.CHZZK_CLIENT_ID,
      clientSecret: env.CHZZK_CLIENT_SECRET,
    }).getChannels(ids);
    await db.transaction(async (tx) => {
      for (const channel of result.channels) {
        await tx
          .insert(channels)
          .values({ ...channel, needsReview: false })
          .onConflictDoUpdate({
            target: channels.channelId,
            set: { ...channel, needsReview: false, updatedAt: new Date().toISOString() },
          });
      }
      if (result.missing.length) {
        for (const channelId of result.missing)
          await tx
            .insert(channels)
            .values({
              channelId,
              channelName: `확인 필요 · ${channelId.slice(0, 6)}`,
              needsReview: true,
            })
            .onConflictDoNothing();
        await tx
          .update(channels)
          .set({ needsReview: true })
          .where(inArray(channels.channelId, result.missing));
      }
    });
    console.log(
      JSON.stringify({ refreshed: result.channels.length, needsReview: result.missing }, null, 2),
    );
  } catch {
    console.error(
      "Channel operation failed. Check arguments, seed file, database and official API credentials.",
    );
    process.exitCode = 1;
  } finally {
    if (process.env.DATABASE_URL) await getSql().end();
  }
}
void main();
