import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { liveScopeSql?: ReturnType<typeof postgres> };
export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 설정이 필요합니다.");
  globalDb.liveScopeSql ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return globalDb.liveScopeSql;
}
export function getDb() {
  return drizzle(getSql(), { schema });
}
