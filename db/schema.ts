import { pgTable, serial, text, timestamp, integer, index, boolean } from "drizzle-orm/pg-core";

// Full news & social media stories shown on the Stories page.
export const stories = pgTable("stories", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  outlet: text().notNull(),
  handle: text().notNull().default(""),
  channel: text().notNull().default("News"), // News | Facebook | X | Instagram | YouTube | Other
  sourceUrl: text("source_url").notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  summary: text().notNull().default(""),
  body: text().notNull().default(""),
  imageUrl: text("image_url"),
  imageCaption: text("image_caption"),
  videoUrl: text("video_url"),
  sentiment: text().notNull().default("NEUTRAL"), // POSITIVE | NEUTRAL | NEGATIVE
  tags: text().notNull().default(""), // space separated hashtags
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User-added links to related content for a story.
export const storyLinks = pgTable(
  "story_links",
  {
    id: serial().primaryKey(),
    storyId: integer("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    title: text().notNull(),
    url: text().notNull(),
    note: text().notNull().default(""),
    addedBy: text("added_by").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("story_links_story_idx").on(t.storyId)],
);

// In-house Ministry data: responses, write-ups, statements, briefs, notes.
export const ministryRecords = pgTable("ministry_records", {
  id: serial().primaryKey(),
  kind: text().notNull().default("Write-up"), // Response | Write-up | Press Release | Statement | Data Brief | Note
  title: text().notNull(),
  body: text().notNull().default(""),
  status: text().notNull().default("Draft"), // Draft | In Review | Approved | Published
  author: text().notNull().default(""),
  department: text().notNull().default("Communications"),
  storyId: integer("story_id").references(() => stories.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Live news & social media mentions collected automatically by the media monitor.
export const mediaMentions = pgTable(
  "media_mentions",
  {
    id: serial().primaryKey(),
    externalId: text("external_id").notNull().unique(), // canonical URL / guid used to de-duplicate
    sourceKey: text("source_key").notNull(),
    outlet: text().notNull(),
    channel: text().notNull().default("News"), // News | YouTube | Reddit | ...
    author: text().notNull().default(""),
    title: text().notNull(),
    summary: text().notNull().default(""),
    url: text().notNull(),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at").notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    sentiment: text().notNull().default("NEUTRAL"), // POSITIVE | NEUTRAL | NEGATIVE
    priority: boolean().notNull().default(false),
    topics: text().notNull().default(""), // space separated hashtags
    analyzed: boolean().notNull().default(false),
    // false when the AI review found no direct link to MOEST or its leadership; hidden from the app.
    relevant: boolean().notNull().default(true),
  },
  (t) => [index("media_mentions_published_idx").on(t.publishedAt)],
);

// Health of each monitored source, updated on every check.
export const monitorSources = pgTable("monitor_sources", {
  key: text().primaryKey(),
  name: text().notNull(),
  channel: text().notNull().default("News"),
  lastCheckedAt: timestamp("last_checked_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastError: text("last_error"),
  lastItemCount: integer("last_item_count").notNull().default(0),
});
