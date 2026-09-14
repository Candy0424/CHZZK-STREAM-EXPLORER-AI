import { pgTable, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
const date = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
export const channels = pgTable("channels", {
  channelId: text("channel_id").primaryKey(),
  channelName: text("channel_name").notNull(),
  channelImageUrl: text("channel_image_url"),
  followerCount: integer("follower_count").notNull().default(0),
  verifiedMark: boolean("verified_mark").notNull().default(false),
  status: text("status", { enum: ["ONLINE", "OFFLINE", "UNKNOWN"] })
    .notNull()
    .default("UNKNOWN"),
  isVisible: boolean("is_visible").notNull().default(true),
  needsReview: boolean("needs_review").notNull().default(false),
  firstDiscoveredAt: date("first_discovered_at").notNull().defaultNow(),
  lastSeenLiveAt: date("last_seen_live_at"),
  lastCheckedAt: date("last_checked_at"),
  updatedAt: date("updated_at").notNull().defaultNow(),
});
export const syncRuns = pgTable("sync_runs", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["RUNNING", "COMPLETE", "FAILED"] }).notNull(),
  startedAt: date("started_at").notNull(),
  completedAt: date("completed_at"),
  pageCount: integer("page_count").notNull().default(0),
  liveCount: integer("live_count").notNull().default(0),
  newChannelCount: integer("new_channel_count").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryAt: date("retry_at"),
});
export const currentLives = pgTable("current_lives", {
  channelId: text("channel_id")
    .primaryKey()
    .references(() => channels.channelId),
  liveId: text("live_id").notNull(),
  liveTitle: text("live_title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  viewerCount: integer("viewer_count").notNull(),
  openDate: date("open_date").notNull(),
  adult: boolean("adult").notNull(),
  categoryType: text("category_type", { enum: ["GAME", "SPORTS", "ETC"] }).notNull(),
  categoryId: text("category_id").notNull(),
  categoryName: text("category_name").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull(),
  syncRunId: text("sync_run_id")
    .notNull()
    .references(() => syncRuns.id),
});
export const liveHistory = pgTable(
  "live_history",
  {
    liveId: text("live_id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.channelId),
    lastTitle: text("last_title").notNull(),
    lastCategoryName: text("last_category_name").notNull(),
    categoryType: text("category_type", { enum: ["GAME", "SPORTS", "ETC"] }).notNull(),
    categoryId: text("category_id").notNull(),
    startedAt: date("started_at").notNull(),
    lastSeenAt: date("last_seen_at").notNull(),
  },
  (table) => [index("history_channel_seen_idx").on(table.channelId, table.lastSeenAt)],
);
