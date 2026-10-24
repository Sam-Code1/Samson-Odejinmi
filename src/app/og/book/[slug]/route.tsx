import { ImageResponse } from "next/og";
import { getProduct, TYPE_LABELS } from "@/lib/products";

export const runtime = "nodejs";
export const revalidate = 86400;

const W = 1200, H = 630;

/** The cover, shrunk to a light JPEG data URL (only our own storage or site images are fetched). */
async function coverData(src: string | null): Promise<string | null> {
  if (!src) return null;
  let url: URL;
  try { url = new URL(src, "https://local.invalid"); } catch { return null; }
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
  if (url.host !== supa || !url.pathname.startsWith("/storage/v1/object/public/")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize({ height: 540, width: 520, fit: "inside" }).flatten({ background: "#10162B" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Share card for a book (WhatsApp, X, LinkedIn, Facebook, iMessage…): 1200 × 630, the cover on the Fola Academy navy
 * with the title, edition and type, delivered as a small JPEG (well under WhatsApp's ~300 KB preview limit).
 * Large uploaded covers (e.g. a 2 MB PNG) are never sent to link previews directly.
 */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return new Response("Not found", { status: 404 });
  const cover = await coverData(p.ogImage ?? p.coverImage);
  const meta = [TYPE_LABELS[p.type], p.edition, p.comingSoon ? "Coming soon" : null].filter(Boolean).join("  ·  ");
  const title = p.name.length > 60 ? `${p.name.slice(0, 57)}…` : p.name;
  const line = (p.shortDescription ?? "").split(/\n/)[0].slice(0, 120);

  const img = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", background: "#080B16", color: "#F4F1EA", position: "relative", fontFamily: "sans-serif",
        backgroundImage: "linear-gradient(rgba(142,168,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(142,168,255,0.07) 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 56px 56px 72px", width: cover ? 640 : W }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", position: "relative", width: 34, height: 34 }}>
              <div style={{ position: "absolute", left: 6, top: 4, width: 7, height: 26, background: "#F4F1EA" }} />
              <div style={{ position: "absolute", left: 6, top: 4, width: 20, height: 7, background: "#F4F1EA" }} />
              <div style={{ position: "absolute", left: 18, top: 15, width: 8, height: 8, borderRadius: 8, background: "#8B72FF" }} />
            </div>
            <div style={{ display: "flex", fontSize: 26 }}><span style={{ fontWeight: 800 }}>Fola</span><span style={{ marginLeft: 8 }}>Academy</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {meta && <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: "#8EA8FF" }}>{meta}</div>}
            <div style={{ display: "flex", marginTop: 18, fontSize: title.length > 32 ? 58 : 70, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
            {line && <div style={{ display: "flex", marginTop: 22, fontSize: 26, lineHeight: 1.35, color: "#A6ABBF" }}>{line}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: "#A6ABBF" }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, border: "2px solid #5B7BFF" }} />
            <div style={{ width: 90, height: 2, background: "linear-gradient(90deg, #5B7BFF, #8B72FF)" }} />
            <div style={{ width: 11, height: 11, background: "#8B72FF" }} />
            <div style={{ display: "flex", marginLeft: 10 }}>Understand first, then build.</div>
          </div>
        </div>
        {cover && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 560, height: H, background: "#10162B" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to an image server-side */}
            <img src={cover} alt="" style={{ maxWidth: 500, maxHeight: 540, borderRadius: 6, boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }} />
          </div>
        )}
      </div>
    ),
    { width: W, height: H },
  );
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(Buffer.from(await img.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "content-type": "image/jpeg", "content-length": String(jpeg.byteLength), "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
