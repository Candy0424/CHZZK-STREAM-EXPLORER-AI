import { config } from "dotenv";
import { getLiveEnv, isDemoMode } from "../src/lib/env";
import { ChzzkClient } from "../src/lib/chzzk-client";
import { createSyncRepository } from "../src/lib/sync-repository";
import { syncLives } from "../src/lib/sync-lives";
import { getSql } from "../src/lib/database";
config({ path: ".env.local", quiet: true });
async function main() {
  try {
    if (isDemoMode()) throw new Error("Set DEMO_MODE=false to sync real channels.");
    const env = getLiveEnv();
    const result = await syncLives(
      createSyncRepository(env.SYNC_INTERVAL_MINUTES),
      new ChzzkClient({ clientId: env.CHZZK_CLIENT_ID, clientSecret: env.CHZZK_CLIENT_SECRET }),
      env.SYNC_MAX_PAGES,
    );
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "FAILED") process.exitCode = 1;
  } catch {
    console.error("Sync could not start. Check .env.local, database migrations and API access.");
    process.exitCode = 1;
  } finally {
    if (process.env.DATABASE_URL) await getSql().end();
  }
}
void main();
