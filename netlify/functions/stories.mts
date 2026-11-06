import type { Config, Context } from "@netlify/functions";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stories, storyLinks } from "../../db/schema.js";
import { ensureSeeded } from "../../db/seed.js";
import { error, json, oneOf, parseId, readBody, safeUrl, str } from "../lib/http.js";
import { isRelevant } from "../lib/relevance.js";

const OUT_OF_SCOPE =
  "This library only records coverage directly linked to the Ministry of Education, Science and Technology, " +
  "Minister Chester Cooper, Director of Education Dominique McCartney-Russell or Permanent Secretary Neil Campbell. " +
  "Name the Ministry or the official in the title, summary or write-up.";
const inScope = (f: ReturnType<typeof storyFields>) => isRelevant(`${f.title}\n${f.summary}\n${f.body}\n${f.tags}`);

const CHANNELS = ["News", "Facebook", "X", "Instagram", "YouTube", "TikTok", "Other"] as const;
const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "story";

function storyFields(body: Record<string, unknown>) {
  return {
    title: str(body.title, 300),
    outlet: str(body.outlet, 200),
    handle: str(body.handle, 100),
    channel: oneOf(body.channel, CHANNELS, "News"),
    sourceUrl: safeUrl(body.sourceUrl),
    summary: str(body.summary, 4000),
    body: str(body.body, 50000),
    imageUrl: safeUrl(body.imageUrl),
    imageCaption: str(body.imageCaption, 500) || null,
    videoUrl: safeUrl(body.videoUrl),
    sentiment: oneOf(body.sentiment, SENTIMENTS, "NEUTRAL"),
    tags: str(body.tags, 500),
  };
}

export default async (req: Request, context: Context) => {
  const id = context.params.id ? parseId(context.params.id) : undefined;
  if (id === null) return error("Invalid story id", 404);

  if (req.method === "GET") {
    await ensureSeeded();
    const rows = id
      ? await db.select().from(stories).where(eq(stories.id, id))
      : await db.select().from(stories).orderBy(desc(stories.publishedAt));
    const links = await db.select().from(storyLinks).orderBy(asc(storyLinks.createdAt));
    const withLinks = rows.map((s) => ({ ...s, links: links.filter((l) => l.storyId === s.id) }));
    if (id) return withLinks[0] ? json(withLinks[0]) : error("Story not found", 404);
    return json(withLinks);
  }

  if (req.method === "POST" && !id) {
    const fields = storyFields(await readBody(req));
    if (!fields.title || !fields.outlet) return error("Title and outlet are required");
    if (!fields.sourceUrl) return error("A valid original source URL (http/https) is required");
    if (!inScope(fields)) return error(OUT_OF_SCOPE, 422);
    const slug = `${slugify(fields.title)}-${Date.now().toString(36)}`;
    const [created] = await db.insert(stories).values({ ...fields, sourceUrl: fields.sourceUrl, slug }).returning();
    return json({ ...created, links: [] }, 201);
  }

  if (req.method === "PUT" && id) {
    const fields = storyFields(await readBody(req));
    if (!fields.title || !fields.outlet) return error("Title and outlet are required");
    if (!fields.sourceUrl) return error("A valid original source URL (http/https) is required");
    if (!inScope(fields)) return error(OUT_OF_SCOPE, 422);
    const [updated] = await db
      .update(stories)
      .set({ ...fields, sourceUrl: fields.sourceUrl })
      .where(eq(stories.id, id))
      .returning();
    return updated ? json(updated) : error("Story not found", 404);
  }

  if (req.method === "DELETE" && id) {
    await db.delete(stories).where(eq(stories.id, id));
    return new Response(null, { status: 204 });
  }

  return error("Method not allowed", 405);
};

export const config: Config = {
  path: ["/api/stories", "/api/stories/:id"],
};
