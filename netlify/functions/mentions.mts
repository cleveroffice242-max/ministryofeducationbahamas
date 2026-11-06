import type { Config, Context } from "@netlify/functions";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { mediaMentions, monitorSources } from "../../db/schema.js";
import { lastCheckedAt, runMonitor } from "../lib/monitor.js";
import { isRelevant } from "../lib/relevance.js";
import { error, json, oneOf, parseId, readBody, str } from "../lib/http.js";

const WINDOW_MS = 7 * 24 * 3600_000;
const MIN_MANUAL_INTERVAL_MS = 45_000;
const CHANNELS = ["News", "Facebook", "X", "Instagram", "YouTube", "TikTok", "Reddit", "Other"] as const;
const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;
const OUT_OF_SCOPE =
  "Live coverage only keeps items directly linked to the Ministry of Education, Science and Technology or its leadership. " +
  "Keep the Ministry or the official named in the headline or summary.";

// Staff edits, archive/restore and removal of a single collected item.
async function updateMention(req: Request, id: number) {
  const [current] = await db.select().from(mediaMentions).where(eq(mediaMentions.id, id));
  if (!current || !current.relevant) return error("Coverage item not found", 404);

  // "Remove" hides the item permanently. The row is kept so the monitor never collects it again.
  if (req.method === "DELETE") {
    await db.update(mediaMentions).set({ relevant: false, analyzed: true }).where(eq(mediaMentions.id, id));
    return new Response(null, { status: 204 });
  }

  const body = await readBody(req);
  const changes: Partial<typeof mediaMentions.$inferInsert> = {};
  if (typeof body.archived === "boolean") changes.archivedAt = body.archived ? new Date() : null;
  if ("title" in body) {
    const title = str(body.title, 300);
    if (!title) return error("A headline is required");
    changes.title = title;
  }
  if ("outlet" in body) {
    const outlet = str(body.outlet, 200);
    if (!outlet) return error("An outlet is required");
    changes.outlet = outlet;
  }
  if ("summary" in body) changes.summary = str(body.summary, 4000);
  if ("author" in body) changes.author = str(body.author, 200);
  if ("topics" in body) changes.topics = str(body.topics, 500);
  if ("channel" in body) changes.channel = oneOf(body.channel, CHANNELS, current.channel as (typeof CHANNELS)[number]);
  if ("sentiment" in body) changes.sentiment = oneOf(body.sentiment, SENTIMENTS, "NEUTRAL");
  if (typeof body.priority === "boolean") changes.priority = body.priority;
  if (!Object.keys(changes).length) return error("Nothing to update");

  if (changes.title !== undefined || changes.summary !== undefined) {
    const title = changes.title ?? current.title;
    const summary = changes.summary ?? current.summary;
    if (!isRelevant(`${title} ${summary}`)) return error(OUT_OF_SCOPE, 422);
  }
  // Mark as analysed so the AI review never overwrites a staff edit.
  if (Object.keys(changes).some((k) => k !== "archivedAt")) changes.analyzed = true;

  const [updated] = await db.update(mediaMentions).set(changes).where(eq(mediaMentions.id, id)).returning();
  return json(updated);
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);

  if (context.params.id && !url.pathname.endsWith("/refresh")) {
    const id = parseId(context.params.id);
    if (!id) return error("Invalid coverage id", 404);
    if (req.method === "PATCH" || req.method === "DELETE") return updateMention(req, id);
    return error("Method not allowed", 405);
  }

  // "Check now": runs the monitor immediately unless it ran very recently.
  if (req.method === "POST" && url.pathname.endsWith("/refresh")) {
    const last = await lastCheckedAt();
    if (last && Date.now() - last.getTime() < MIN_MANUAL_INTERVAL_MS) {
      return json({ skipped: true, checkedAt: last });
    }
    return json(await runMonitor());
  }

  if (req.method !== "GET") return error("Method not allowed", 405);

  // ?view=archived lists archived items of any age; the default is the live 7-day window.
  const archived = url.searchParams.get("view") === "archived";
  const since = new Date(Date.now() - WINDOW_MS);
  const where = archived
    ? and(eq(mediaMentions.relevant, true), isNotNull(mediaMentions.archivedAt))
    : and(gte(mediaMentions.publishedAt, since), eq(mediaMentions.relevant, true), isNull(mediaMentions.archivedAt));
  const [rows, sources] = await Promise.all([
    db.select().from(mediaMentions).where(where)
      .orderBy(desc(archived ? mediaMentions.archivedAt : mediaMentions.publishedAt)).limit(400),
    db.select().from(monitorSources),
  ]);
  // Older items were collected under broader education keywords; only show those
  // that directly reference the Ministry or its leadership.
  const mentions = rows.filter((m) => isRelevant(`${m.title} ${m.summary}`));
  const checked = sources.map((s) => s.lastCheckedAt?.getTime() || 0);
  return json({
    mentions,
    sources,
    lastCheckedAt: checked.length && Math.max(...checked) ? new Date(Math.max(...checked)) : null,
    serverTime: new Date(),
  });
};

export const config: Config = {
  path: ["/api/mentions", "/api/mentions/refresh", "/api/mentions/:id"],
};
