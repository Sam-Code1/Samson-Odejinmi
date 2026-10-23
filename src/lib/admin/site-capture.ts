import type { AdminContext } from "./guard";
import { uploadImage } from "./storage";
import { canEmbed, framingAllowed } from "@/lib/site-embed";

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
  /** Last time the live site was checked (a refresh that found no visible change only moves this). */
  checkedAt?: string;
  /** Change detection: a 32×20 greyscale thumbnail of the first screen (base64) and the page length in CSS px. */
  fp?: string; pageH?: number;
  /** Screenshots this capture added to the project gallery (replaced, not duplicated, when the site changes). */
  gallery?: string[];
  /** Re-captured daily by the scheduled job (default on). */
  autoRefresh?: boolean;
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
  const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(45_000) }).catch(() => null);
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.byteLength > 80 * 1024 * 1024 ? null : buf;
}

/** Can another site show this page in an iframe? Microlink's view of the headers; confirmed directly by canEmbed(). */
function isEmbeddable(h: Record<string, string>) {
  return framingAllowed(h);
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

/** HD: captures at 2× pixel density (a 1440px-wide desktop becomes a 2880px image; phones are Retina too). */
const DPR = 2;
const MAX_UPLOAD = 4.9 * 1024 * 1024;

/**
 * A tiny greyscale thumbnail of the first screen plus the page length: two captures with nearly the same fingerprint
 * show the same website, so a scheduled refresh can skip re-uploading (animations and clocks don't count as changes).
 */
async function fingerprint(sharp: (typeof import("sharp"))["default"], full: Buffer, w: number, view: number) {
  const px = await sharp(full).extract({ left: 0, top: 0, width: w, height: view }).resize(32, 20, { fit: "fill" }).greyscale().raw().toBuffer();
  return Buffer.from(px).toString("base64");
}
function sameSite(a: { fp?: string; pageH?: number } | null | undefined, fp: string, pageH: number) {
  if (!a?.fp || !a.pageH) return false;
  const x = Buffer.from(a.fp, "base64"), y = Buffer.from(fp, "base64");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff += Math.abs(x[i] - y[i]);
  return diff / x.length < 6 && Math.abs(a.pageH - pageH) / a.pageH < 0.03;
}

export type Unchanged = { unchanged: true; embeddable: boolean; checkedAt: string };

/**
 * Visit the site through Microlink, then store a hero, a tall scrolling capture, a phone view and up to three sections,
 * all in HD. With `previous`, an unchanged site returns { unchanged } before anything is uploaded.
 */
export async function captureSite(ctx: AdminContext, url: string, label: string, previous?: SitePreview | null): Promise<Capture | Unchanged | { error: string }> {
  const [desk, phone] = await Promise.all([
    microlink({ url, meta: "true", screenshot: "true", "screenshot.fullPage": "true", "screenshot.type": "png", "viewport.width": "1440", "viewport.height": "900", "viewport.deviceScaleFactor": String(DPR), waitForTimeout: "1500", force: "true" }),
    microlink({ url, meta: "false", screenshot: "true", "screenshot.type": "png", "viewport.isMobile": "true", "viewport.width": "390", "viewport.height": "844", "viewport.deviceScaleFactor": "3", waitForTimeout: "1500", force: "true" }),
  ]);
  if ("error" in desk) return desk;
  const full = await downloadShot(desk.data.screenshot?.url);
  if (!full) return { error: "The screenshot couldn't be downloaded. Try again." };

  const sharp = (await import("sharp")).default;
  const meta = await sharp(full, { limitInputPixels: false }).metadata();
  const W = meta.width ?? 1440 * DPR, H = meta.height ?? 900 * DPR;
  const scale = W / 1440;
  const VIEW = Math.min(Math.round(900 * scale), H);
  const finalUrl = normaliseSiteUrl(desk.data.url ?? url) ?? url;
  // Decided by the site's own headers, fetched directly (Microlink doesn't always pass X-Frame-Options through).
  const direct = await canEmbed(finalUrl);
  const embeddable = direct ?? isEmbeddable(desk.headers);
  const fp = await fingerprint(sharp, full, W, VIEW);
  const pageH = Math.round(H / scale);
  if (previous && sameSite(previous, fp, pageH)) return { unchanged: true, embeddable, checkedAt: new Date().toISOString() };

  const store = async (buf: Buffer, part: string, alt: string): Promise<Shot | null> => {
    const m = await sharp(buf).metadata();
    const file = new File([new Uint8Array(buf)], `${label}-${part}.webp`, { type: "image/webp" });
    const up = await uploadImage(ctx, file, "portfolio", { alt_text: alt });
    return up.ok ? { src: up.url, w: m.width ?? 0, h: m.height ?? 0 } : null;
  };
  /** High quality first; steps down only if a very long page would exceed the upload limit. */
  const encode = async (img: () => ReturnType<(typeof import("sharp"))["default"]>, qualities = [90, 82, 72, 62]) => {
    let out = await img().webp({ quality: qualities[0], effort: 5, smartSubsample: true }).toBuffer();
    for (const q of qualities.slice(1)) { if (out.byteLength <= MAX_UPLOAD) break; out = await img().webp({ quality: q, effort: 5 }).toBuffer(); }
    return out;
  };
  const name = clean(desk.data.title, 140) ?? new URL(url).hostname;
  const crop = (top: number, height: number) => () => sharp(full, { limitInputPixels: false }).extract({ left: 0, top, width: W, height });

  const sectionTops = [1, 2, 3].map((i) => VIEW * i).filter((top) => top + 450 * scale <= H);
  const tallH = Math.min(H, Math.round(7200 * scale));
  const [hero, tall, mobile, ...sectionShots] = await Promise.all([
    encode(crop(0, VIEW)).then((b) => store(b, "hero", `${name}: home page`)),
    // The scrolling preview: the whole page at 1800px wide (crisp on Retina at the frame's size), capped in length.
    H > VIEW * 1.4 ? encode(() => crop(0, tallH)().resize({ width: 1800 }), [84, 76, 66, 56]).then((b) => store(b, "page", `${name}: full page`)) : Promise.resolve(null),
    "error" in phone ? Promise.resolve(null) : downloadShot(phone.data.screenshot?.url).then(async (p) => (p ? store(await encode(() => sharp(p)), "mobile", `${name}: on a phone`) : null)),
    ...sectionTops.map((top, i) => encode(crop(top, Math.min(VIEW, H - top))).then((b) => store(b, `section-${i + 1}`, `${name}: section ${i + 2}`))),
  ]);
  if (!hero) return { error: "The screenshot couldn't be saved. Check the storage bucket exists (migration 0002)." };
  const sections = sectionShots.filter((s): s is Shot => !!s);

  return {
    preview: {
      url: finalUrl, domain: new URL(finalUrl).hostname.replace(/^www\./, ""), title: name, description: clean(desk.data.description, 400),
      siteName: clean(desk.data.publisher, 80), lang: clean(desk.data.lang, 12), embeddable,
      hero, tall, mobile, fetchedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), fp, pageH,
      gallery: [...sections.map((s) => s.src), ...(mobile ? [mobile.src] : [])],
      autoRefresh: previous?.autoRefresh ?? true,
    },
    sections,
    techHints: techFrom(desk.headers),
  };
}
