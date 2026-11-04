CREATE TABLE "media_mentions" (
	"id" serial PRIMARY KEY,
	"external_id" text NOT NULL UNIQUE,
	"source_key" text NOT NULL,
	"outlet" text NOT NULL,
	"channel" text DEFAULT 'News' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"published_at" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"sentiment" text DEFAULT 'NEUTRAL' NOT NULL,
	"priority" boolean DEFAULT false NOT NULL,
	"topics" text DEFAULT '' NOT NULL,
	"analyzed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_sources" (
	"key" text PRIMARY KEY,
	"name" text NOT NULL,
	"channel" text DEFAULT 'News' NOT NULL,
	"last_checked_at" timestamp,
	"last_success_at" timestamp,
	"last_error" text,
	"last_item_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_mentions_published_idx" ON "media_mentions" ("published_at");