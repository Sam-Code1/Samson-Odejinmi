import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Orders: guest and account purchases share ONE order record (the `payments` row + `payment_items`), see migration 0013.
 *
 * Guest access is a secure ORDER ACCESS TOKEN:
 *   - 32 random bytes (crypto.randomBytes), base64url: unguessable, not derived from any id;
 *   - only its SHA-256 is stored (order_access_tokens); the raw token lives in the buyer's httpOnly cookie (this
 *     browser) and in the confirmation email link;
 *   - expires (30 days) and can be revoked; a new one is sent to the purchase email on request (/order/access);
 *   - it grants exactly one order: its receipt, its downloads, reviews of its products, and claiming it into an account.
 * Order numbers (FOLA-2026-000123) and references are display/lookup values only, never accepted as authorization.
 */
export const TOKEN_DAYS = 30;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const isTokenShape = (t: unknown): t is string => typeof t === "string" && TOKEN_RE.test(t);

export type OrderRow = {
  id: string; reference: string; order_number: string; status: string; user_id: string | null; guest_email: string | null; customer_name: string | null;
  amount_minor: number; base_amount_minor: number | null; discount_minor: number; tax_minor: number; currency: string; provider: string;
  created_at: string; paid_at: string | null; failure_reason: string | null;
};
export type OrderItem = { product_id: string | null; course_id: string | null; name: string; unit_minor: number; product_type: string | null; slug: string | null; course_slug: string | null; has_file: boolean };

/** Creates and stores a new access token for an order. Returns the RAW token (show/send it once; never stored). */
export async function issueOrderToken(paymentId: string, channel: "browser" | "email" | "regenerated"): Promise<string | null> {
  const service = createServiceClient();
  if (!service) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const { error } = await service.from("order_access_tokens").insert({
    payment_id: paymentId, token_hash: hashToken(token), channel, expires_at: new Date(Date.now() + TOKEN_DAYS * 864e5).toISOString(),
  });
  if (error) { console.error("[orders] token not stored:", error.code); return null; }
  return token;
}

/** Resolves a raw token to its order (valid, not expired, not revoked). Server-only. */
export async function orderForToken(token: unknown): Promise<{ order: OrderRow; tokenId: string } | null> {
  if (!isTokenShape(token)) return null;
  const service = createServiceClient();
  if (!service) return null;
  const { data: t } = await service.from("order_access_tokens").select("id, payment_id, expires_at, revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!t || t.revoked_at || new Date(t.expires_at as string).getTime() < Date.now()) return null;
  const { data: order } = await service.from("payments")
    .select("id, reference, order_number, status, user_id, guest_email, customer_name, amount_minor, base_amount_minor, discount_minor, tax_minor, currency, provider, created_at, paid_at, failure_reason")
    .eq("id", t.payment_id as string).maybeSingle();
  if (!order) return null;
  await service.from("order_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", t.id as string);
  return { order: order as OrderRow, tokenId: t.id as string };
}

/** Line items of an order with what the receipt needs (download available? course to open?). Server-only. */
export async function orderItems(paymentId: string): Promise<OrderItem[]> {
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service.from("payment_items")
    .select("product_id, course_id, name, unit_minor, products(product_type, slug, courses(slug)), courses(slug)").eq("payment_id", paymentId).order("created_at");
  const rows = (data ?? []) as unknown as { product_id: string | null; course_id: string | null; name: string; unit_minor: number; products: { product_type: string; slug: string; courses: { slug: string } | null } | null; courses: { slug: string } | null }[];
  // Files (and bundle contents) the order can download.
  const productIds = rows.map((r) => r.product_id).filter((x): x is string => !!x);
  const { data: ents } = await service.from("entitlements").select("product_id, products!entitlements_product_id_fkey(name, product_type, slug)").eq("payment_id", paymentId).in("status", ["active", "merged"]);
  const extra = ((ents ?? []) as unknown as { product_id: string; products: { name: string; product_type: string; slug: string } | null }[])
    .filter((e) => e.products && !productIds.includes(e.product_id))
    .map((e) => ({ product_id: e.product_id, course_id: null, name: `${e.products!.name} (in bundle)`, unit_minor: 0, products: { product_type: e.products!.product_type, slug: e.products!.slug, courses: null }, courses: null }));
  const all = [...rows, ...extra];
  const ids = all.map((r) => r.product_id).filter((x): x is string => !!x);
  const { data: files } = ids.length ? await service.from("product_files").select("product_id").in("product_id", ids) : { data: [] };
  const withFile = new Set(((files ?? []) as { product_id: string }[]).map((f) => f.product_id));
  return all.map((r) => ({
    product_id: r.product_id, course_id: r.course_id, name: r.name, unit_minor: r.unit_minor, product_type: r.products?.product_type ?? (r.course_id ? "course" : null),
    slug: r.products?.slug ?? null, course_slug: r.courses?.slug ?? r.products?.courses?.slug ?? null, has_file: !!r.product_id && withFile.has(r.product_id),
  }));
}

/** This browser's token for an order, kept in an httpOnly cookie so the payment return page can find the receipt. */
const orderCookie = (reference: string) => `fa_o_${reference.replace(/[^A-Z0-9-]/g, "")}`;
export async function rememberOrder(reference: string, token: string) {
  (await cookies()).set(orderCookie(reference), token, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: TOKEN_DAYS * 86400 });
}
export async function rememberedOrderToken(reference: string) {
  return (await cookies()).get(orderCookie(reference))?.value ?? null;
}

/** A per-network key for abuse limits: HMAC of the IP (never stored raw). */
export async function networkHash(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  if (!ip) return null;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fola";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/** Records a commerce analytics event. Never blocks the purchase; no personal data. */
export async function trackCommerce(event: "add_to_cart" | "checkout_started" | "payment_started" | "purchase_completed" | "download" | "account_claimed" | "review_submitted" | "currency_selected",
  o: { productId?: string | null; paymentId?: string | null; currency?: string | null; provider?: string | null; guest?: boolean | null } = {}) {
  try {
    const service = createServiceClient();
    if (!service) return;
    await service.from("commerce_events").insert({ event, product_id: o.productId ?? null, payment_id: o.paymentId ?? null, currency: o.currency ?? null, provider: o.provider ?? null, guest: o.guest ?? null });
  } catch { /* analytics never blocks */ }
}
