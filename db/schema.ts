import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

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
