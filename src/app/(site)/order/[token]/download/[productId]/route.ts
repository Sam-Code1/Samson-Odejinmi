import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/validation";
import { orderForToken } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Secure download for an ORDER (guest or account), authorised by the order's private access token:
 *   token (hashed lookup, not expired/revoked) → order → database check (prepare_order_download: order paid, product in
 *   this order or its bundle, entitlement still active, file exists, downloads on, rate limit; logs the download)
 *   → a 60-second signed link to the PRIVATE product-files bucket. No permanent or public file URL ever exists.
 * An order number, email or product id alone grants nothing.
 */
const NOINDEX = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const page = (title: string, body: string, status: number, token?: string) => new NextResponse(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 20px;color:#15171a;background:#fbfaf7">
<h1 style="font-size:1.5rem;font-weight:600">${title}</h1><p>${body}</p>
<p>${token ? `<a href="/order/${token}" style="color:#2a4fd6">Back to your order</a> · ` : ""}<a href="/order/access" style="color:#2a4fd6">Get a new link</a></p></body>`,
  { status, headers: { ...NOINDEX, "Content-Type": "text/html; charset=utf-8" } },
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; productId: string }> }) {
  const { token, productId } = await params;
  if (!isUuid(productId)) return page("We couldn't find that download", "The link looks incomplete.", 404);
  const found = await orderForToken(token);
  if (!found) return page("This link has expired or isn't valid", "Order links are private and expire after 30 days. Enter your purchase email to get a new one.", 403);
  const service = createServiceClient();
  if (!service) return page("We couldn't prepare your download", "Downloads aren't available right now. Please try again shortly.", 503, token);
  const { data, error } = await service.rpc("prepare_order_download", { p_payment: found.order.id, p_product: productId });
  const r = data as { ok: boolean; error?: string; file_path?: string; file_name?: string } | null;
  if (error || !r) return page("We couldn't prepare your download", "Please try again in a moment.", 502, token);
  if (!r.ok) {
    const map: Record<string, [string, string, number]> = {
      rate_limited: ["Too many downloads", "Please wait a little and try again. Your purchase is safe.", 429],
      no_file: ["This file isn't available yet", "We've been told and will add it shortly. Your purchase is safe.", 404],
      downloads_off: ["Downloads are paused", "Downloads are temporarily paused. Please try again later. Your purchase is safe.", 503],
    };
    const [t, b, s] = map[r.error ?? ""] ?? ["This download isn't part of your order", "If you think this is wrong, contact us with your order number.", 403];
    return page(t, b, s, token);
  }
  const { data: signed, error: se } = await service.storage.from("product-files").createSignedUrl(r.file_path!, 60, { download: r.file_name });
  if (se || !signed) return page("We couldn't prepare your download", "Please try again. Your purchase is safe.", 502, token);
  return NextResponse.redirect(signed.signedUrl, { headers: NOINDEX });
}
