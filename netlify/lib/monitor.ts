// Media monitor: pulls Bahamian news and social feeds, keeps education-related
// items, scores sentiment and stores new mentions in the database.
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte, inArray, max } from "drizzle-orm";
import { db } from "../../db/index.js";
import { mediaMentions, monitorSources } from "../../db/schema.js";

type Source = {
  key: string;
  name: string;
  channel: string;
  url: string;
  outlet?: string; // fixed outlet name; Google News items carry their own
  filter: boolean; // only keep items matching education keywords
  kind?: "rss" | "facebook";
  minIntervalMs?: number; // check less often than every minute
};

const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

const EDU = "(school OR schools OR education OR students OR teachers OR BGCSE OR BJC)";
const site = (domain: string) => gnews(`site:${domain} ${EDU} when:7d`);

export const SOURCES: Source[] = [
  { key: "gnews-ministry", name: "Google News: Ministry of Education", channel: "News", filter: false,
    url: gnews('"Ministry of Education" Bahamas when:7d') },
  { key: "gnews-higher-ed", name: "Google News: UB, BTVI & teachers' union", channel: "News", filter: false,
    url: gnews('("University of The Bahamas" OR BTVI OR "Bahamas Union of Teachers") when:7d') },
  { key: "gnews-guardian", name: "The Nassau Guardian", channel: "News", outlet: "The Nassau Guardian", filter: true,
    url: site("thenassauguardian.com") },
  { key: "gnews-ewnews", name: "EyeWitness News", channel: "News", outlet: "EyeWitness News", filter: true,
    url: site("ewnews.com") },
  { key: "gnews-tribune", name: "The Tribune (search)", channel: "News", outlet: "The Tribune", filter: true,
    url: site("tribune242.com") },
  { key: "gnews-bahamaspress", name: "Bahamas Press", channel: "News", outlet: "Bahamas Press", filter: true,
    url: site("bahamaspress.com") },
  { key: "tribune", name: "The Tribune (latest)", channel: "News", outlet: "The Tribune", filter: true,
    url: "https://www.tribune242.com/rss/headlines/" },
  { key: "zns", name: "ZNS Bahamas", channel: "News", outlet: "ZNS Bahamas", filter: true,
    url: "https://znsbahamas.com/feed/" },
  { key: "ournews", name: "Our News", channel: "News", outlet: "Our News", filter: true,
    url: "https://ournews.bs/feed/" },
  { key: "zns-youtube", name: "ZNS Network (YouTube)", channel: "YouTube", outlet: "The ZNS Network", filter: true,
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCPCeBf3Uyx_uSaBZehylzPg" },
  { key: "reddit-bahamas", name: "r/Bahamas (Reddit)", channel: "Reddit", outlet: "r/Bahamas", filter: true,
    url: "https://www.reddit.com/r/Bahamas/new/.rss?limit=50" },
];

// ---------- Facebook: public Pages of Bahamian news outlets ----------
// Read through Meta's Graph API with an app token that has "Page Public Content Access".
// Set FACEBOOK_ACCESS_TOKEN to enable. FACEBOOK_PAGES can override the list as
// "pageUsernameOrId:Display Name, ...". Posts written by the Ministry itself are excluded.
const FB_GRAPH = "https://graph.facebook.com/v23.0";
const FB_INTERVAL_MS = 10 * 60_000;
const DEFAULT_FB_PAGES = [
  "ZNSBahamas:ZNS Bahamas",
  "ewnewsbahamas:EyeWitness News",
  "OurNewsBahamas:Our News",
  "tribune242:The Tribune",
  "thenassauguardian:The Nassau Guardian",
  "bahamaspress:Bahamas Press",
];
// Authors treated as "the Ministry" and never stored.
const MINISTRY_AUTHOR = /\b(ministry of education|MOEST)\b/i;
const ministryIds = () => new Set((process.env.FACEBOOK_MINISTRY_PAGE_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));

function facebookSources(): Source[] {
  if (!process.env.FACEBOOK_ACCESS_TOKEN) return [];
  const list = process.env.FACEBOOK_PAGES ? process.env.FACEBOOK_PAGES.split(",") : DEFAULT_FB_PAGES;
  return list.map((entry) => {
    const [page, ...rest] = entry.trim().split(":");
    const name = rest.join(":").trim() || page;
    return {
      key: `facebook-${page.toLowerCase()}`, name: `${name} (Facebook)`, channel: "Facebook", outlet: name,
      filter: true, kind: "facebook" as const, minIntervalMs: FB_INTERVAL_MS, url: page.trim(),
    };
  }).filter((s) => s.url);
}

export const allSources = () => [...SOURCES, ...facebookSources()];

type FbPost = {
  id: string; message?: string; created_time: string; permalink_url?: string; full_picture?: string;
  from?: { id: string; name: string };
};

async function fetchFacebook(src: Source): Promise<(RawItem & { outlet: string })[]> {
  const params = new URLSearchParams({
    fields: "id,message,created_time,permalink_url,full_picture,from",
    limit: "25",
    access_token: process.env.FACEBOOK_ACCESS_TOKEN || "",
  });
  const res = await fetch(`${FB_GRAPH}/${encodeURIComponent(src.url)}/posts?${params}`, { signal: AbortSignal.timeout(8000) });
  const body = (await res.json().catch(() => ({}))) as { data?: FbPost[]; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(`Facebook: ${body.error?.message || `HTTP ${res.status}`}`);
  const skipIds = ministryIds();
  const cutoff = Date.now() - MAX_AGE_MS;
  return (body.data || [])
    .filter((p) => p.message && !(p.from && (skipIds.has(p.from.id) || MINISTRY_AUTHOR.test(p.from.name))))
    .map((p) => {
      const text = p.message!.replace(/\s+/g, " ").trim();
      const firstLine = p.message!.split("\n").map((l) => l.trim()).find(Boolean) || text;
      const title = firstLine.length > 160 ? firstLine.slice(0, 157).trimEnd() + "…" : firstLine;
      return {
        externalId: `fb:${p.id}`,
        title,
        summary: text.slice(0, 1200),
        url: p.permalink_url || `https://www.facebook.com/${p.id}`,
        publishedAt: new Date(p.created_time),
        outlet: src.outlet || src.name,
        author: p.from?.name || "",
        imageUrl: p.full_picture || null,
      };
    })
    .filter((i) => i.publishedAt.getTime() > cutoff && isRelevant(i.summary));
}

const MAX_AGE_MS = 7 * 24 * 3600_000;
const UA = "Mozilla/5.0 (compatible; MOESTMediaMonitor/1.0; +https://ministryofeducationbahamas.netlify.app)";

// ---------- Relevance ----------
const KEYWORDS_CI =
  /\b(education|educat\w*|schools?|students?|teachers?|pupils?|classrooms?|principals?|curriculum|scholarships?|exams?|examinations?|bgcse|bjc|preschool|pre-school|kindergarten|graduat\w*|literacy|university of the bahamas|minister of education|ministry of education|tvet|truancy|school bus\w*|back.to.school|high school|all.age|college|academy|science fair|belinda wilson|youth parliament|textbooks?|tuition)\b/i;
const KEYWORDS_CS = /\b(MOEST|BTVI|BUT|UB|BGCSE|BJC|BHSD)\b/;
export const isRelevant = (text: string) => KEYWORDS_CI.test(text) || KEYWORDS_CS.test(text);

// ---------- Tiny RSS / Atom parser ----------
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

const stripHtml = (s: string) =>
  decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};
const attr = (xml: string, name: string, attribute: string) => {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*${attribute}=["']([^"']+)["']`, "i"));
  return m ? decode(m[1]) : "";
};

type RawItem = {
  externalId?: string;
  title: string; url: string; summary: string; publishedAt: Date;
  outlet?: string; author: string; imageUrl: string | null;
};

export function parseFeed(xml: string): RawItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const isAtom = b.startsWith("<entry");
    const rawDesc = isAtom ? tag(b, "media:description") || tag(b, "content") || tag(b, "summary") : tag(b, "description");
    const encoded = tag(b, "content:encoded");
    const img =
      attr(b, "media:thumbnail", "url") || attr(b, "media:content", "url") || attr(b, "enclosure", "url") ||
      (decode(encoded || rawDesc).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || null;
    const url = isAtom ? attr(b, "link", "href") : stripHtml(tag(b, "link"));
    const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    let summary = stripHtml(rawDesc);
    summary = summary.replace(/The post .* appeared first on .*$/i, "").replace(/submitted by .*$/i, "").trim();
    return {
      title: stripHtml(tag(b, "title")),
      url,
      summary: summary.slice(0, 1200),
      publishedAt: date ? new Date(stripHtml(date)) : new Date(),
      outlet: stripHtml(tag(b, "source")) || undefined,
      author: stripHtml(tag(b, "dc:creator") || tag(tag(b, "author"), "name")),
      imageUrl: img && /^https?:\/\//.test(img) && !/\.swf|youtube\.com\/v\//.test(img) ? img : null,
    };
  });
}

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 140);

// ---------- Sentiment ----------
const NEG = /\b(concern\w*|complain\w*|outage|crisis|shortage|protest\w*|strike|fail\w*|violence|stabb\w*|shoot\w*|fight\w*|arrest\w*|delay\w*|criticis\w*|frustrat\w*|unsafe|mould|mold|leak\w*|closed|closure|lawsuit|dispute|unpaid|scandal|blame\w*)\b/i;
const POS = /\b(award\w*|celebrat\w*|launch\w*|expan\w*|record.high|success\w*|graduat\w*|scholarship\w*|commend\w*|improv\w*|achiev\w*|donat\w*|upgrade\w*|opens?|wins?|honou?r\w*|partnership)\b/i;

function heuristic(text: string) {
  const neg = NEG.test(text), pos = POS.test(text);
  const sentiment = neg && !pos ? "NEGATIVE" : pos && !neg ? "POSITIVE" : "NEUTRAL";
  return { sentiment, priority: sentiment === "NEGATIVE" && /\b(school|student|teacher|ministry|education)/i.test(text) };
}

const HEURISTIC_TOPICS: [RegExp, string][] = [
  [/\b(BGCSE|BJC|exam)/i, "#Exams"], [/\bteacher|\bBUT\b|union/i, "#Teachers"], [/breakfast|meal|lunch/i, "#SchoolMeals"],
  [/\bAC\b|air.condition|repair|maintenance|outage|mould|mold/i, "#SchoolFacilities"], [/university|\bUB\b|BTVI|TVET/i, "#HigherEd"],
  [/STEM|science|technology|coding|digital/i, "#STEM"], [/scholarship/i, "#Scholarships"], [/violence|fight|stabb|police|safety/i, "#SchoolSafety"],
];
const heuristicTopics = (text: string) => HEURISTIC_TOPICS.filter(([re]) => re.test(text)).map(([, t]) => t).slice(0, 3).join(" ");

type Analysis = { id: number; sentiment: string; priority: boolean; topics: string };

export async function analyzeWithAI(items: { id: number; title: string; summary: string; outlet: string }[]): Promise<Analysis[]> {
  const anthropic = new Anthropic();
  const list = items.map((i) => ({ id: i.id, outlet: i.outlet, title: i.title, summary: i.summary.slice(0, 400) }));
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system:
      "You are a media analyst for the Ministry of Education, Science and Technology (MOEST) of The Bahamas. " +
      "For each news or social media item, judge its sentiment toward Bahamian education and the Ministry: " +
      "POSITIVE (good news, achievements, investments), NEGATIVE (problems, complaints, criticism, safety incidents in schools) or NEUTRAL. " +
      "Set priority=true only when the item likely needs a Ministry communications response (public criticism, school safety, outages, disputes). " +
      "Give 1-3 short CamelCase hashtags describing the topic (e.g. #SchoolSafety, #BGCSE2026, #TeacherPay). " +
      'Reply with ONLY a JSON array: [{"id":number,"sentiment":"POSITIVE|NEUTRAL|NEGATIVE","priority":boolean,"topics":["#Tag"]}]',
    messages: [{ role: "user", content: JSON.stringify(list) }],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  const parsed = JSON.parse(json) as { id: number; sentiment: string; priority: boolean; topics: string[] }[];
  const valid = new Set(["POSITIVE", "NEUTRAL", "NEGATIVE"]);
  return parsed
    .filter((p) => items.some((i) => i.id === p.id))
    .map((p) => ({
      id: p.id,
      sentiment: valid.has(p.sentiment) ? p.sentiment : "NEUTRAL",
      priority: Boolean(p.priority),
      topics: (Array.isArray(p.topics) ? p.topics : [])
        .map((t) => "#" + String(t).replace(/[^A-Za-z0-9_]/g, ""))
        .filter((t) => t.length > 2)
        .slice(0, 3)
        .join(" "),
    }));
}

// ---------- Run ----------
async function fetchSource(src: Source) {
  if (src.kind === "facebook") return fetchFacebook(src);
  const res = await fetch(src.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = parseFeed(await res.text());
  const cutoff = Date.now() - MAX_AGE_MS;
  return items
    .map((i) => {
      let { title, outlet } = i;
      if (src.key.startsWith("gnews")) {
        // Google News titles end with " - Outlet"
        const m = title.match(/^(.*) - ([^-]+)$/);
        if (m) { title = m[1].trim(); outlet = outlet || m[2].trim(); }
        if (i.summary.startsWith(title)) i.summary = "";
      }
      return { ...i, title, outlet: src.outlet || outlet || src.name };
    })
    .filter((i) => i.title && i.url && !isNaN(i.publishedAt.getTime()) && i.publishedAt.getTime() > cutoff)
    .filter((i) => !src.filter || isRelevant(`${i.title} ${i.summary}`));
}

export async function lastCheckedAt(): Promise<Date | null> {
  const [row] = await db.select({ at: max(monitorSources.lastCheckedAt) }).from(monitorSources);
  return row?.at ?? null;
}

export async function runMonitor() {
  const started = new Date();
  // Skip sources that were checked recently and ask to be polled less often.
  const statuses = await db.select({ key: monitorSources.key, at: monitorSources.lastCheckedAt }).from(monitorSources);
  const lastByKey = new Map(statuses.map((s) => [s.key, s.at?.getTime() || 0]));
  const due = allSources().filter((s) => !s.minIntervalMs || started.getTime() - (lastByKey.get(s.key) || 0) >= s.minIntervalMs - 5_000);
  const results = await Promise.allSettled(due.map(fetchSource));
  let inserted = 0;

  for (let i = 0; i < due.length; i++) {
    const src = due[i];
    const r = results[i];
    const ok = r.status === "fulfilled";
    const items = ok ? r.value : [];

    if (items.length) {
      const rows = items.map((it) => {
        const text = `${it.title} ${it.summary}`;
        const h = heuristic(text);
        return {
          externalId: it.externalId || normTitle(it.title),
          sourceKey: src.key,
          outlet: it.outlet.slice(0, 200),
          channel: src.channel,
          author: it.author.slice(0, 200),
          title: it.title.slice(0, 500),
          summary: it.summary,
          url: it.url.slice(0, 2000),
          imageUrl: it.imageUrl,
          publishedAt: it.publishedAt > started ? started : it.publishedAt,
          sentiment: h.sentiment,
          priority: h.priority,
          topics: heuristicTopics(text),
        };
      });
      // De-duplicate within the batch, then let the unique index skip known items.
      const unique = [...new Map(rows.map((r) => [r.externalId, r])).values()];
      const added = await db.insert(mediaMentions).values(unique).onConflictDoNothing().returning({ id: mediaMentions.id });
      inserted += added.length;
    }

    const status = {
      name: src.name,
      channel: src.channel,
      lastCheckedAt: started,
      lastError: r.status === "rejected" ? String(r.reason?.message || r.reason).slice(0, 300) : null,
      lastItemCount: items.length,
      ...(ok ? { lastSuccessAt: started } : {}),
    };
    await db.insert(monitorSources).values({ key: src.key, ...status })
      .onConflictDoUpdate({ target: monitorSources.key, set: status });
  }

  // AI sentiment for recent items that haven't been analysed yet.
  const pending = await db
    .select({ id: mediaMentions.id, title: mediaMentions.title, summary: mediaMentions.summary, outlet: mediaMentions.outlet })
    .from(mediaMentions)
    .where(and(eq(mediaMentions.analyzed, false), gte(mediaMentions.fetchedAt, new Date(Date.now() - 3 * 24 * 3600_000))))
    .limit(40);
  let analyzed = 0;
  if (pending.length) {
    try {
      const results = await analyzeWithAI(pending);
      for (const a of results) {
        await db.update(mediaMentions)
          .set({ sentiment: a.sentiment, priority: a.priority, topics: a.topics || undefined, analyzed: true })
          .where(eq(mediaMentions.id, a.id));
      }
      analyzed = results.length;
      // Anything the model skipped keeps its keyword-based score.
      const done = new Set(results.map((r) => r.id));
      const skipped = pending.filter((p) => !done.has(p.id)).map((p) => p.id);
      if (skipped.length) await db.update(mediaMentions).set({ analyzed: true }).where(inArray(mediaMentions.id, skipped));
    } catch (e) {
      console.error("Sentiment analysis failed; keeping keyword scores", e);
    }
  }

  const failed = due.filter((_, i) => results[i].status === "rejected").map((s) => s.key);
  console.log(`Media monitor: ${inserted} new, ${analyzed} analysed, failed sources: ${failed.join(", ") || "none"}`);
  return { inserted, analyzed, failed, checkedAt: started };
}
