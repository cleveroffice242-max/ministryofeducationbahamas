CREATE TABLE "ministry_records" (
	"id" serial PRIMARY KEY,
	"kind" text DEFAULT 'Write-up' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"department" text DEFAULT 'Communications' NOT NULL,
	"story_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"outlet" text NOT NULL,
	"handle" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'News' NOT NULL,
	"source_url" text NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"image_url" text,
	"image_caption" text,
	"video_url" text,
	"sentiment" text DEFAULT 'NEUTRAL' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_links" (
	"id" serial PRIMARY KEY,
	"story_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"added_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "story_links_story_idx" ON "story_links" ("story_id");--> statement-breakpoint
ALTER TABLE "ministry_records" ADD CONSTRAINT "ministry_records_story_id_stories_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "story_links" ADD CONSTRAINT "story_links_story_id_stories_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE;