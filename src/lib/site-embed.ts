import { site } from "@/lib/site";

/**
 * Can a website be shown live inside our project page (an iframe)? Decided by the site's OWN response headers,
 * fetched directly: X-Frame-Options (DENY / SAMEORIGIN block everyone else) and CSP frame-ancestors (must allow us).
 * Server-side only. Returns null when the site couldn't be reached, so callers can keep their last known answer.
 */
const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
const IP = /^\d+\.\d+\.\d+\.\d+$|^\[/;

export function framingAllowed(headers: Record<string, string>, ourHost = new URL(site.url).host): boolean {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const xfo = (h["x-frame-options"] ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const fa = /frame-ancestors([^;]*)/i.exec(h["content-security-policy"] ?? "")?.[1]?.trim().toLowerCase();
  if (fa === undefined) return true;
  const sources = fa.split(/\s+/).filter(Boolean);
  return sources.some((s) => s === "*" || s === "https:" || s.replace(/^https?:\/\//, "").replace(/\/$/, "") === ourHost.toLowerCase()
    || (s.includes("*.") && ourHost.toLowerCase().endsWith(s.slice(s.indexOf("*.") + 1))));
}

export async function canEmbed(url: string): Promise<boolean | null> {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" || BLOCKED_HOST.test(u.hostname) || IP.test(u.hostname)) return null;
  try {
    const res = await fetch(u, {
      redirect: "follow", headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; SamsonOdejinmiPortfolio/1.0; +https://samsonodejinmi.vercel.app)" },
      signal: AbortSignal.timeout(6000), next: { revalidate: 3600 },
    });
    res.body?.cancel().catch(() => undefined);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return framingAllowed(headers);
  } catch {
    return null;
  }
}
