/**
 * Marketing attribution (UTM + affiliate referral). Pure helpers, safe on the edge and in server code.
 *
 * Privacy: only campaign parameters are stored (source, medium, campaign, content, term, referral code, landing path,
 * date), in first-party cookies, and only when the visitor arrived through a tagged link. No IDs, no IPs, no
 * fingerprinting. The database cleans the values again (clean_attribution) before storing them on a payment.
 */
export const REF_COOKIE = "fola_ref";
export const ATTR_COOKIE = "fola_attr";
export const REF_MAX_AGE = 60 * 60 * 24 * 30;   // a referral counts for 30 days
export const ATTR_MAX_AGE = 60 * 60 * 24 * 90;

export type Touch = { source?: string; medium?: string; campaign?: string; content?: string; term?: string; ref?: string; landing?: string; at?: string };
export type Attribution = { first?: Touch; last?: Touch };

const FIELDS = ["source", "medium", "campaign", "content", "term", "ref", "landing", "at"] as const;

/** Lower-case token: letters, digits, dot, dash, underscore, plus. Max 60. */
export function cleanToken(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._+-]/g, "").slice(0, 60);
  return t || undefined;
}

export function cleanRefCode(v: unknown): string | undefined {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9_-]{2,23}$/.test(t) ? t : undefined;
}

function cleanPath(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//")) return undefined;
  return v.replace(/[^A-Za-z0-9/_.-]/g, "").slice(0, 120) || undefined;
}

export function cleanTouch(t: unknown): Touch | undefined {
  if (!t || typeof t !== "object") return undefined;
  const o = t as Record<string, unknown>;
  const out: Touch = {};
  for (const k of FIELDS) {
    const v = k === "landing" ? cleanPath(o[k]) : k === "ref" ? cleanRefCode(o[k]) : k === "at" ? (typeof o[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o[k] as string) ? (o[k] as string) : undefined) : cleanToken(o[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The touch described by a landing URL, or null when the URL carries no campaign parameters. */
export function touchFromUrl(url: URL, today = new Date()): Touch | null {
  const p = url.searchParams;
  const ref = cleanRefCode(p.get("ref"));
  const t: Touch = {
    source: cleanToken(p.get("utm_source")) ?? (ref ? "affiliate" : undefined),
    medium: cleanToken(p.get("utm_medium")) ?? (ref ? "referral" : undefined),
    campaign: cleanToken(p.get("utm_campaign")),
    content: cleanToken(p.get("utm_content")),
    term: cleanToken(p.get("utm_term")),
    ref,
    landing: cleanPath(url.pathname),
    at: today.toISOString().slice(0, 10),
  };
  if (!t.source && !t.campaign && !t.ref) return null;
  return cleanTouch(t) ?? null;
}

/** First touch is kept forever (until the cookie expires); last touch is replaced by every tagged visit. */
export function mergeAttribution(existing: Attribution | null, touch: Touch): Attribution {
  return { first: existing?.first ?? touch, last: touch };
}

export function parseAttribution(raw: string | undefined | null): Attribution | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const first = cleanTouch(o.first), last = cleanTouch(o.last);
    return first || last ? { ...(first ? { first } : {}), ...(last ? { last } : {}) } : null;
  } catch {
    return null;
  }
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(JSON.stringify(a));
}

/** UTM-tagged link for a post / email / campaign (used by the content campaign manager). */
export function buildTrackedUrl(base: string, utm: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; term?: string | null }): string | null {
  let u: URL;
  try { u = new URL(base); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const set = (k: string, v?: string | null) => { const t = cleanToken(v ?? ""); if (t) u.searchParams.set(k, t); };
  set("utm_source", utm.source); set("utm_medium", utm.medium); set("utm_campaign", utm.campaign); set("utm_content", utm.content); set("utm_term", utm.term);
  return u.toString();
}
