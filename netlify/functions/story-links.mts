import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { stories, storyLinks } from "../../db/schema.js";
import { error, json, parseId, readBody, safeUrl, str } from "../lib/http.js";
import { requireEditor } from "../lib/auth.js";

export default async (req: Request, context: Context) => {
  const denied = await requireEditor();
  if (denied) return denied;
  if (req.method === "POST" && context.params.id) {
    const storyId = parseId(context.params.id);
    if (!storyId) return error("Invalid story id", 404);
    const [story] = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, storyId));
    if (!story) return error("Story not found", 404);

    const body = await readBody(req);
    const url = safeUrl(body.url);
    if (!url) return error("Please provide a valid http(s) link");
    const title = str(body.title, 300) || new URL(url).hostname;
    const [link] = await db
      .insert(storyLinks)
      .values({ storyId, url, title, note: str(body.note, 1000), addedBy: str(body.addedBy, 120) })
      .returning();
    return json(link, 201);
  }

  if (req.method === "DELETE" && context.params.linkId) {
    const linkId = parseId(context.params.linkId);
    if (!linkId) return error("Invalid link id", 404);
    await db.delete(storyLinks).where(eq(storyLinks.id, linkId));
    return new Response(null, { status: 204 });
  }

  return error("Method not allowed", 405);
};

export const config: Config = {
  path: ["/api/stories/:id/links", "/api/links/:linkId"],
};
