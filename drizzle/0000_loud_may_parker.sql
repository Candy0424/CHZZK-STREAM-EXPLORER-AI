CREATE TABLE "channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"channel_name" text NOT NULL,
	"channel_image_url" text,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"verified_mark" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'UNKNOWN' NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"first_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_live_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "current_lives" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"live_id" text NOT NULL,
	"live_title" text NOT NULL,
	"thumbnail_url" text,
	"viewer_count" integer NOT NULL,
	"open_date" timestamp with time zone NOT NULL,
	"adult" boolean NOT NULL,
	"category_type" text NOT NULL,
	"category_id" text NOT NULL,
	"category_name" text NOT NULL,
	"tags" jsonb NOT NULL,
	"sync_run_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_history" (
	"live_id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"last_title" text NOT NULL,
	"last_category_name" text NOT NULL,
	"category_type" text NOT NULL,
	"category_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"page_count" integer DEFAULT 0 NOT NULL,
	"live_count" integer DEFAULT 0 NOT NULL,
	"new_channel_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"retry_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "current_lives" ADD CONSTRAINT "current_lives_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "current_lives" ADD CONSTRAINT "current_lives_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_history" ADD CONSTRAINT "live_history_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "history_channel_seen_idx" ON "live_history" USING btree ("channel_id","last_seen_at");