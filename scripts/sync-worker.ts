import { config } from "dotenv";
import { setTimeout } from "node:timers/promises";
import { ChzzkClient } from "../src/lib/chzzk-client";
import { getSql } from "../src/lib/database";
import { getLiveEnv, isDemoMode } from "../src/lib/env";
import { syncLives } from "../src/lib/sync-lives";
import { createSyncRepository } from "../src/lib/sync-repository";

config({ path: ".env.local", quiet: true });
const shutdown = new AbortController();
process.once("SIGINT", () => shutdown.abort());
process.once("SIGTERM", () => shutdown.abort());

async function main() {
  if (isDemoMode()) throw new Error("Live mode is required.");
  const env = getLiveEnv();
  const client = new ChzzkClient({
    clientId: env.CHZZK_CLIENT_ID,
    clientSecret: env.CHZZK_CLIENT_SECRET,
  });
  const repository = createSyncRepository(env.SYNC_INTERVAL_MINUTES);
  while (!shutdown.signal.aborted) {
    try {
      console.log(JSON.stringify(await syncLives(repository, client, env.SYNC_MAX_PAGES)));
    } catch {
      console.error("Sync could not run. Check database availability and configuration.");
    }
    try {
      await setTimeout(env.SYNC_INTERVAL_MINUTES * 60000, undefined, { signal: shutdown.signal });
    } catch {
      // A shutdown interrupts the interval, not an in-flight snapshot transaction.
      break;
    }
  }
}

main()
  .catch(() => {
    console.error("Live sync worker could not start. Check .env.local.");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await getSql().end({ timeout: 5 });
  });
