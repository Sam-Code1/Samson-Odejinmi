import type { AdminContext } from "./guard";
import { uploadImage } from "./storage";

/**
 * Website projects: paste a link, get its details and screenshots.
 *
 * Microlink (microlink.io) visits the page in a real browser and returns its title, description, logo, response headers
 * and screenshots. Our server never requests the pasted URL itself (no server-side request forgery surface); it only
 * downloads the finished screenshots from Microlink's own CDN, re-encodes them with sharp and stores them in our public
 * academy-media bucket, so the portfolio never depends on Microlink after import. Works without a key (a small daily
 * allowance); set MICROLINK_API_KEY for more.
 */
export type Shot = { src: string; w: number; h: number };
export type SitePreview = {
  url: string; domain: string; title: string | null; description: string | null; siteName: string | null; lang: string | null;
  /** Whether the site allows being shown inside another page (X-Frame-Options / CSP frame-ancestors). */
  embeddable: boolean;
  hero: Shot; tall: Shot | null; mobile: Shot | null; fetchedAt: string;
};
export type Capture = { preview: SitePreview; sections: Shot[]; techHints: string[] };

const BLOCKED_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost|0\.0\.0\.0)$/i;
const PRIVATE_IP = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/** A public https address, or null. Adds https:// when it's missing. */
export function normaliseSiteUrl(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  let u: URL;
  try { u = new URL(v); } catch { return null; }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const host = u.hostname;
  if (!host.includes(".") || BLOCKED_HOST.test(host) || PRIVATE_IP.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  u.hash = "";
  return u.toString();
}

type MicrolinkData = {
  title?: string; description?: string; publisher?: string; lang?: string; url?: string;
  screenshot?: { url?: string; width?: number; height?: number };
};

async function microlink(params: Record<string, string>): Promise<{ data: MicrolinkData; headers: Record<string, string> } | { error: string }> {
  const key = process.env.MICROLINK_API_KEY;
  const endpoint = new URL(key ? "https://pro.microlink.io/" : "https://api.microlink.io/");
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, v);
  try {
    const res = await fetch(endpoint, { headers: key ? { "x-api-key": key } : {}, cache: "no-store", signal: AbortSignal.timeout(50_000) });
    const json = (await res.json().catch(() => null)) as { status?: string; message?: string; code?: string; data?: MicrolinkData; headers?: Record<string, string> } | null;
    if (res.status === 429 || json?.code === "ERATE") return { error: "The screenshot service's free daily limit is used up. Try again tomorrow, or add a MICROLINK_API_KEY." };
    if (!res.ok || json?.status !== "success" || !json.data) return { error: json?.message ? `The site couldn't be captured: ${json.message.slice(0, 140)}` : "The site couldn't be captured. Check the link opens in a browser." };
    return { data: json.data, headers: Object.fromEntries(Object.entries(json.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])) };
  } catch {
    return { error: "The screenshot service didn't answer in time. Try again in a minute." };
  }
}

/** Only Microlink's own CDN is ever downloaded from. */
async function downloadShot(url: string | undefined): Promise<Buffer | null> {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" || !(u.hostname === "microlink.io" || u.hostname.endsWith(".microlink.io"))) return null;
  const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.byteLength > 40 * 1024 * 1024 ? null : buf;
}

/** Can another site show this page in an iframe? Conservative: anything restrictive means no. */
function isEmbeddable(h: Record<string, string>) {
  const xfo = (h["x-frame-options"] ?? "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const fa = /frame-ancestors([^;]*)/i.exec(h["content-security-policy"] ?? "")?.[1]?.trim().toLowerCase();
  if (fa !== undefined && !fa.split(/\s+/).includes("*")) return false;
  return true;
}

/** Honest hints from response headers only (never guessed from looks). Offered as Tools when that field is empty. */
function techFrom(h: Record<string, string>) {
  const out = new Set<string>();
  const server = (h.server ?? "").toLowerCase(), powered = (h["x-powered-by"] ?? "").toLowerCase();
  if (powered.includes("next.js") || Object.keys(h).some((k) => k.startsWith("x-nextjs"))) out.add("Next.js");
  if (server.includes("vercel") || h["x-vercel-id"]) out.add("Vercel");
  if (server.includes("netlify") || h["x-nf-request-id"]) out.add("Netlify");
  if (Object.keys(h).some((k) => k.startsWith("x-shopify") || k === "x-shopid")) out.add("Shopify");
  if ((h.link ?? "").includes("wp-json") || powered.includes("wordpress")) out.add("WordPress");
  if (Object.keys(h).some((k) => k.startsWith("x-wix"))) out.add("Wix");
  if (server.includes("framer")) out.add("Framer");
  if (powered.includes("express")) out.add("Express");
  return [...out];
}

const clean = (s: string | undefined | null, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max) || null;

/** Visit the site through Microlink, then store a hero, a tall scrolling capture, a phone view and up to three sections. */
export async function captureSite(ctx: AdminContext, url: string, label: string): Promise<Capture | { error: string }> {
  const [desk, phone] = await Promise.all([
    microlink({ url, meta: "true", screenshot: "true", "screenshot.fullPage": "true", "screenshot.type": "png", "viewport.width": "1440", "viewport.height": "900", "viewport.deviceScaleFactor": "1", waitForTimeout: "1500", force: "true" }),
    microlink({ url, meta: "false", screenshot: "true", "screenshot.type": "png", "viewport.isMobile": "true", "viewport.width": "390", "viewport.height": "844", "viewport.deviceScaleFactor": "2", waitForTimeout: "1500", force: "true" }),
  ]);
  if ("error" in desk) return desk;
  const full = await downloadShot(desk.data.screenshot?.url);
  if (!full) return { error: "The screenshot couldn't be downloaded. Try again." };

  const sharp = (await import("sharp")).default;
  const meta = await sharp(full).metadata();
  const W = meta.width ?? 1440, H = meta.height ?? 900;
  const VIEW = Math.min(900, H);
  const store = async (buf: Buffer, part: string, alt: string): Promise<Shot | null> => {
    const m = await sharp(buf).metadata();
    const file = new File([new Uint8Array(buf)], `${label}-${part}.webp`, { type: "image/webp" });
    const up = await uploadImage(ctx, file, "portfolio", { alt_text: alt });
    return up.ok ? { src: up.url, w: m.width ?? 0, h: m.height ?? 0 } : null;
  };
  const name = clean(desk.data.title, 140) ?? new URL(url).hostname;

  // All crops are encoded and uploaded in parallel (the capture itself already took most of the time budget).
  const crop = (top: number, height: number, q: number, width?: number) => {
    const img = sharp(full).extract({ left: 0, top, width: W, height });
    return (width ? img.resize({ width }) : img).webp({ quality: q }).toBuffer();
  };
  const sectionTops = [1, 2, 3].map((i) => VIEW * i).filter((top) => top + 450 <= H);
  const [hero, tall, mobile, ...sectionShots] = await Promise.all([
    crop(0, VIEW, 82).then((b) => store(b, "hero", `${name}: home page`)),
    // The scrolling preview: the whole page, capped so it stays light.
    H > VIEW * 1.4 ? crop(0, Math.min(H, 7200), 70, 1200).then((b) => store(b, "page", `${name}: full page`)) : Promise.resolve(null),
    "error" in phone ? Promise.resolve(null) : downloadShot(phone.data.screenshot?.url).then(async (p) => (p ? store(await sharp(p).webp({ quality: 80 }).toBuffer(), "mobile", `${name}: on a phone`) : null)),
    ...sectionTops.map((top, i) => crop(top, Math.min(VIEW, H - top), 80).then((b) => store(b, `section-${i + 1}`, `${name}: section ${i + 2}`))),
  ]);
  if (!hero) return { error: "The screenshot couldn't be saved. Check the storage bucket exists (migration 0002)." };
  const sections = sectionShots.filter((s): s is Shot => !!s);

  const finalUrl = normaliseSiteUrl(desk.data.url ?? url) ?? url;
  return {
    preview: {
      url: finalUrl, domain: new URL(finalUrl).hostname.replace(/^www\./, ""), title: name, description: clean(desk.data.description, 400),
      siteName: clean(desk.data.publisher, 80), lang: clean(desk.data.lang, 12), embeddable: isEmbeddable(desk.headers),
      hero, tall, mobile, fetchedAt: new Date().toISOString(),
    },
    sections,
    techHints: techFrom(desk.headers),
  };
}
