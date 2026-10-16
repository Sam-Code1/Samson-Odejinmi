import type { AdminContext } from "./guard";

/**
 * Product restrictions and campaign links for the coupon form. Returns undefined fields until migration 0008 exists,
 * so the coupon screens keep working on older databases.
 */
export async function couponExtras(ctx: AdminContext, couponId?: string) {
  const [prod, camp, sel] = await Promise.all([
    ctx.supabase.from("products").select("id, name").neq("status", "archived").order("name"),
    ctx.supabase.from("marketing_campaigns").select("id, name").neq("status", "archived").order("created_at", { ascending: false }),
    couponId ? ctx.supabase.from("coupon_products").select("product_id").eq("coupon_id", couponId) : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    products: prod.error ? undefined : ((prod.data ?? []) as { id: string; name: string }[]),
    campaigns: camp.error ? undefined : ((camp.data ?? []) as { id: string; name: string }[]),
    selectedProducts: sel.error ? [] : ((sel.data ?? []) as { product_id: string }[]).map((r) => r.product_id),
  };
}
