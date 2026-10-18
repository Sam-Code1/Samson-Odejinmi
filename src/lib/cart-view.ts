import { contentClient } from "@/lib/cms";
import { supabaseConfigured } from "@/lib/supabase/server";
import { TYPE_LABELS, type ProductType } from "@/lib/products";
import { itemKey, type CartItem } from "@/lib/cart";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Display lines for a cart (names, images, the price in each currency). DISPLAY ONLY: what is charged is decided by
 * the database at checkout (order_quote/create_order) from the same tables. Unpublished items come back as
 * `available: false` so the shopper can remove them.
 */
export type CartLine = { key: string; item: CartItem; name: string; typeLabel: string; href: string | null; image: string | null; prices: Record<string, number>; available: boolean };

export async function cartLines(items: CartItem[]): Promise<CartLine[]> {
  if (!items.length || !supabaseConfigured) return [];
  const supabase = await contentClient();
  const pIds = items.filter((i) => i.kind === "product").map((i) => i.id);
  const cIds = items.filter((i) => i.kind === "course").map((i) => i.id);
  const [{ data: products }, { data: courses }] = await Promise.all([
    pIds.length ? supabase.from("products").select("id, slug, name, product_type, cover_image, course_id, courses(slug), product_prices(currency, amount_minor, active)").in("id", pIds).eq("status", "published") : Promise.resolve({ data: [] }),
    cIds.length ? supabase.from("courses").select("id, slug, title, image_url").in("id", cIds).eq("status", "published") : Promise.resolve({ data: [] }),
  ]);
  const courseIds = [...cIds, ...((products ?? []) as { product_type: string; course_id: string | null }[]).filter((p) => p.product_type === "course" && p.course_id).map((p) => p.course_id!)];
  const { data: pricing } = courseIds.length ? await supabase.from("course_pricing").select("course_id, currency, amount_minor").in("course_id", courseIds).eq("active", true) : { data: [] };
  const coursePrices = (id: string) => Object.fromEntries(((pricing ?? []) as { course_id: string; currency: string; amount_minor: number }[]).filter((r) => r.course_id === id).map((r) => [r.currency, Number(r.amount_minor)]));

  return items.map((item) => {
    const key = itemKey(item);
    if (item.kind === "product") {
      const p = ((products ?? []) as Record<string, unknown>[]).find((x) => x.id === item.id);
      if (!p) return { key, item, name: "No longer available", typeLabel: "", href: null, image: null, prices: {}, available: false };
      const type = p.product_type as ProductType;
      const own = ((p.product_prices ?? []) as { currency: string; amount_minor: number; active: boolean }[]).filter((x) => x.active !== false);
      const prices = type === "course" && p.course_id ? coursePrices(p.course_id as string) : Object.fromEntries(own.map((x) => [x.currency, Number(x.amount_minor)]));
      const courseSlug = (p.courses as { slug?: string } | null)?.slug;
      return { key, item, name: p.name as string, typeLabel: TYPE_LABELS[type] ?? "Product", href: type === "course" && courseSlug ? `/academy/courses/${courseSlug}` : `/shop/${p.slug}`, image: (p.cover_image as string | null) ?? null, prices, available: true };
    }
    const c = ((courses ?? []) as Record<string, unknown>[]).find((x) => x.id === item.id);
    if (!c) return { key, item, name: "No longer available", typeLabel: "", href: null, image: null, prices: {}, available: false };
    return { key, item, name: c.title as string, typeLabel: "Course", href: `/academy/courses/${c.slug}`, image: (c.image_url as string | null) ?? null, prices: coursePrices(c.id as string), available: true };
  });
}

/** Whether guest checkout is switched on (Admin → Products → Shop settings). Defaults to on. */
export async function guestCheckoutEnabled(): Promise<boolean> {
  const service = createServiceClient();
  if (!service) return false; // guest orders need the server key; without it accounts are required
  const { data, error } = await service.from("shop_settings").select("guest_checkout_enabled").eq("id", true).maybeSingle();
  if (error || !data) return true;
  return data.guest_checkout_enabled !== false;
}
