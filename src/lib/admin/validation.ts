export const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function str(fd: FormData, key: string, max = 500): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export function optStr(fd: FormData, key: string, max = 500): string | null {
  const v = str(fd, key, max);
  return v === "" ? null : v;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function int(fd: FormData, key: string, fallback: number, min = 0, max = 1_000_000): number {
  const n = Number.parseInt(String(fd.get(key) ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** One item per line, trimmed, blanks removed. */
export function lines(fd: FormData, key: string, maxItems = 30, maxLen = 300): string[] {
  return String(fd.get(key) ?? "")
    .split("\n")
    .map((l) => l.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Absolute http(s) URL, or null. Rejects javascript:, data: and anything else. */
export function httpUrl(v: string): string | null {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Link target for buttons: a same-site path ("/about", "/portfolio#work"), an https URL, or mailto:. */
export function safeHref(v: string): string | null {
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) return v;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v)) return v;
  const u = httpUrl(v);
  return u && u.startsWith("https:") ? u : null;
}

/** Image source: a same-site path or an https URL. */
export function safeImageUrl(v: string): string | null {
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) return v;
  const u = httpUrl(v);
  return u && u.startsWith("https:") ? u : null;
}

/** Comma- or newline-separated list → trimmed, de-duplicated array. */
export function list(fd: FormData, key: string, maxItems = 30, maxLen = 120): string[] {
  return [...new Set(String(fd.get(key) ?? "").split(/[\n,]/).map((s) => s.trim().slice(0, maxLen)).filter(Boolean))].slice(0, maxItems);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"]);

/**
 * Accepts a bare 11-character id or a YouTube URL and returns ONLY the id (or null).
 * Anything else, including pasted <iframe> embed code, is rejected. Only the id is ever stored.
 */
export function parseYouTubeId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (YT_ID.test(v)) return v;
  let url: URL;
  try {
    url = new URL(v.startsWith("http") ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(url.hostname.toLowerCase())) return null;
  let id: string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (url.pathname === "/watch") id = url.searchParams.get("v");
  else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
    id = m ? m[1] : null;
  }
  return id && YT_ID.test(id) ? id : null;
}

export function pageParam(v: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(v) ? v[0] : (v ?? "1"), 10);
  return Number.isNaN(n) || n < 1 ? 1 : Math.min(n, 10_000);
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Escapes characters that are special inside a PostgREST ilike/or filter. */
export function safeSearch(q: string): string {
  return q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "–";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function formatDate(d: string | null | undefined, withTime = false): string {
  if (!d) return "–";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}
