import type { Config } from "@netlify/functions";
import { desc, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { mediaMentions, monitorSources } from "../../db/schema.js";
import { lastCheckedAt, runMonitor } from "../lib/monitor.js";
import { error, json } from "../lib/http.js";

const WINDOW_MS = 7 * 24 * 3600_000;
const MIN_MANUAL_INTERVAL_MS = 45_000;

export default async (req: Request) => {
  const url = new URL(req.url);

  // "Check now": runs the monitor immediately unless it ran very recently.
  if (req.method === "POST" && url.pathname.endsWith("/refresh")) {
    const last = await lastCheckedAt();
    if (last && Date.now() - last.getTime() < MIN_MANUAL_INTERVAL_MS) {
      return json({ skipped: true, checkedAt: last });
    }
    return json(await runMonitor());
  }

  if (req.method !== "GET") return error("Method not allowed", 405);

  const since = new Date(Date.now() - WINDOW_MS);
  const [mentions, sources] = await Promise.all([
    db.select().from(mediaMentions).where(gte(mediaMentions.publishedAt, since))
      .orderBy(desc(mediaMentions.publishedAt)).limit(400),
    db.select().from(monitorSources),
  ]);
  const checked = sources.map((s) => s.lastCheckedAt?.getTime() || 0);
  return json({
    mentions,
    sources,
    lastCheckedAt: checked.length && Math.max(...checked) ? new Date(Math.max(...checked)) : null,
    serverTime: new Date(),
  });
};

export const config: Config = {
  path: ["/api/mentions", "/api/mentions/refresh"],
};
