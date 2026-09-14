import { z } from "zod";
const liveEnv = z.object({
  CHZZK_CLIENT_ID: z.string().min(1),
  CHZZK_CLIENT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
  CRON_SECRET: z.string().min(32),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(2).max(60).default(5),
  SYNC_MAX_PAGES: z.coerce.number().int().min(1).max(10000).default(1000),
});
export function isDemoMode() {
  if (process.env.DEMO_MODE !== undefined) return process.env.DEMO_MODE === "true";
  return (
    !process.env.DATABASE_URL && !process.env.CHZZK_CLIENT_ID && !process.env.CHZZK_CLIENT_SECRET
  );
}
export function getLiveEnv() {
  const result = liveEnv.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `환경 변수 설정 필요: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  return result.data;
}
