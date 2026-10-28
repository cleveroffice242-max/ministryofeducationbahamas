import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { ministryRecords } from "../../db/schema.js";
import { ensureSeeded } from "../../db/seed.js";
import { error, json, oneOf, parseId, readBody, str } from "../lib/http.js";

const KINDS = ["Response", "Write-up", "Press Release", "Statement", "Data Brief", "Note"] as const;
const STATUSES = ["Draft", "In Review", "Approved", "Published"] as const;

function recordFields(body: Record<string, unknown>) {
  const storyId = Number(body.storyId);
  return {
    kind: oneOf(body.kind, KINDS, "Write-up"),
    title: str(body.title, 300),
    body: str(body.body, 100000),
    status: oneOf(body.status, STATUSES, "Draft"),
    author: str(body.author, 120),
    department: str(body.department, 120) || "Communications",
    storyId: Number.isInteger(storyId) && storyId > 0 ? storyId : null,
  };
}

export default async (req: Request, context: Context) => {
  const id = context.params.id ? parseId(context.params.id) : undefined;
  if (id === null) return error("Invalid record id", 404);

  if (req.method === "GET") {
    await ensureSeeded();
    if (id) {
      const [row] = await db.select().from(ministryRecords).where(eq(ministryRecords.id, id));
      return row ? json(row) : error("Record not found", 404);
    }
    return json(await db.select().from(ministryRecords).orderBy(desc(ministryRecords.updatedAt)));
  }

  if (req.method === "POST" && !id) {
    const fields = recordFields(await readBody(req));
    if (!fields.title) return error("Title is required");
    const [created] = await db.insert(ministryRecords).values(fields).returning();
    return json(created, 201);
  }

  if (req.method === "PUT" && id) {
    const fields = recordFields(await readBody(req));
    if (!fields.title) return error("Title is required");
    const [updated] = await db
      .update(ministryRecords)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(ministryRecords.id, id))
      .returning();
    return updated ? json(updated) : error("Record not found", 404);
  }

  if (req.method === "DELETE" && id) {
    await db.delete(ministryRecords).where(eq(ministryRecords.id, id));
    return new Response(null, { status: 204 });
  }

  return error("Method not allowed", 405);
};

export const config: Config = {
  path: ["/api/records", "/api/records/:id"],
};
