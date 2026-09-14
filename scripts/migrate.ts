import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, getSql } from "../src/lib/database";
config({ path: ".env.local", quiet: true });
async function main() {
  try {
    await migrate(getDb(), { migrationsFolder: "./drizzle" });
    console.log("Database migrations complete.");
  } catch {
    console.error(
      "Migration failed. Check DATABASE_URL and database availability. Connection details are not logged.",
    );
    process.exitCode = 1;
  } finally {
    if (process.env.DATABASE_URL) await getSql().end();
  }
}
void main();
