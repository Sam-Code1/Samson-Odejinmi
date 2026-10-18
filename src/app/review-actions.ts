"use server";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/validation";
import { orderForToken } from "@/lib/orders";
import { REVIEW_ERRORS } from "@/lib/reviews";

/**
 * Reviews. Only owners can review, and "verified purchase" is decided by the database, never by the browser:
 *   - signed in: submit_review (the database checks the account owns the product);
 *   - guest: the server first verifies the order's private token, then submit_order_review (the database checks the
 *     order is paid and entitles that product).
 * New and edited reviews wait for moderation.
 */
export type ReviewState = { ok?: boolean; error?: string };

const fields = (fd: FormData) => ({
  product: String(fd.get("productId") ?? ""),
  rating: Number.parseInt(String(fd.get("rating") ?? ""), 10),
  title: String(fd.get("title") ?? "").slice(0, 120),
  body: String(fd.get("body") ?? "").slice(0, 4000),
  name: String(fd.get("display_name") ?? "").slice(0, 60),
});

export async function submitReview(_: ReviewState, fd: FormData): Promise<ReviewState> {
  const f = fields(fd);
  if (!isUuid(f.product)) return { error: "Something went wrong. Please refresh and try again." };
  if (!(f.rating >= 1 && f.rating <= 5)) return { error: REVIEW_ERRORS.rating };
  const token = String(fd.get("t") ?? "");
  if (token) {
    const found = await orderForToken(token);
    if (!found) return { error: "This link has expired. Ask for a new one with your purchase email." };
    const service = createServiceClient();
    if (!service) return { error: "Reviews aren't available right now." };
    const { data, error } = await service.rpc("submit_order_review", { p_payment: found.order.id, p_product: f.product, p_rating: f.rating, p_title: f.title, p_body: f.body, p_display_name: f.name });
    const r = data as { ok: boolean; error?: string } | null;
    if (error || !r) return { error: "We couldn't save your review. Please try again." };
    return r.ok ? { ok: true } : { error: REVIEW_ERRORS[r.error ?? ""] ?? "We couldn't save your review." };
  }
  if (!(await getUser())) return { error: REVIEW_ERRORS.sign_in };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_review", { p_product: f.product, p_rating: f.rating, p_title: f.title, p_body: f.body, p_display_name: f.name });
  const r = data as { ok: boolean; error?: string } | null;
  if (error || !r) return { error: "We couldn't save your review. Please try again." };
  return r.ok ? { ok: true } : { error: REVIEW_ERRORS[r.error ?? ""] ?? "We couldn't save your review." };
}

export async function reportReview(reviewId: string): Promise<{ ok: boolean; message: string }> {
  if (!isUuid(reviewId)) return { ok: false, message: "Couldn't report this review." };
  if (!(await getUser())) return { ok: false, message: "Sign in to report a review." };
  const supabase = await createClient();
  const { data } = await supabase.rpc("report_review", { p_review: reviewId });
  return data === true ? { ok: true, message: "Thanks. We'll take a look." } : { ok: false, message: "Couldn't report this review." };
}
