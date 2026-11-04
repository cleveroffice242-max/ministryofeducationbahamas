// API data changes constantly, so never let browsers or the CDN cache it.
const NO_STORE = { "Cache-Control": "no-store, max-age=0", "Netlify-CDN-Cache-Control": "no-store" };
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: NO_STORE });
export const error = (message: string, status = 400) => Response.json({ error: message }, { status, headers: NO_STORE });

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max = 20000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Only allow http(s) URLs so stored links can't carry javascript: or data: payloads.
export function safeUrl(v: unknown): string | null {
  const s = str(v, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

export const parseId = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
