import { cache } from "react";
import { contentClient } from "@/lib/cms";
import { supabaseConfigured } from "@/lib/supabase/server";

/**
 * Product reviews (migration 0014). Public reads go through two database functions that return APPROVED reviews only,
 * with safe columns only (no user ids, emails or orders). Ratings are computed from approved reviews; nothing is seeded.
 */
export type Rating = { average: number; count: number };
export type PublicReview = { id: string; displayName: string; rating: number; title: string | null; body: string | null; verified: boolean; createdAt: string };

export const getRatings = cache(async (productIds: string[] | null): Promise<Map<string, Rating>> => {
  const m = new Map<string, Rating>();
  if (!supabaseConfigured || (productIds && !productIds.length)) return m;
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.rpc("product_ratings", { p_products: productIds });
    if (error || !data) return m; // before 0014
    for (const r of data as { product_id: string; average: number | string; review_count: number }[]) m.set(r.product_id, { average: Number(r.average), count: Number(r.review_count) });
  } catch { /* no ratings shown */ }
  return m;
});

export async function getProductReviews(productId: string, page = 1, perPage = 10): Promise<PublicReview[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.rpc("product_reviews_public", { p_product: productId, p_limit: perPage, p_offset: (Math.max(page, 1) - 1) * perPage });
    if (error || !data) return [];
    return (data as { id: string; display_name: string; rating: number; title: string | null; body: string | null; verified: boolean; created_at: string }[])
      .map((r) => ({ id: r.id, displayName: r.display_name, rating: r.rating, title: r.title, body: r.body, verified: r.verified, createdAt: r.created_at }));
  } catch {
    return [];
  }
}

export const REVIEW_ERRORS: Record<string, string> = {
  sign_in: "Please sign in to review.",
  reviews_off: "Reviews are paused right now.",
  rating: "Choose a rating from 1 to 5 stars.",
  not_purchased: "Only customers who bought this can review it.",
  too_many: "You've submitted a lot of reviews recently. Please try again later.",
};
