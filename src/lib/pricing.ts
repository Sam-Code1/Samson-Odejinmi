import { defaultPricing, type Currency, type PriceRow } from "@/content/course";
import { supabaseConfigured } from "@/lib/supabase/server";
import { contentClient } from "@/lib/cms";
import { regionalCurrency } from "@/lib/currency";

/** Reads configurable pricing from `course_pricing`, falling back to defaults if unavailable. */
export async function getCoursePricing(courseSlug: string): Promise<PriceRow[]> {
  if (!supabaseConfigured) return defaultPricing;
  try {
    const supabase = await contentClient();
    const { data: course } = await supabase.from("courses").select("id").eq("slug", courseSlug).eq("status", "published").maybeSingle();
    if (!course) return [];
    const { data } = await supabase.from("course_pricing").select("currency, amount_minor").eq("course_id", course.id).eq("active", true);
    const rows = (data ?? [])
      .filter((r) => r.currency === "NGN" || r.currency === "USD" || r.currency === "GBP")
      .map((r) => ({ currency: r.currency as Currency, amountMinor: Number(r.amount_minor) }));
    return rows;
  } catch {
    return [];
  }
}

/** @deprecated Use getShopperCurrency / regionalCurrency from lib/currency (one rule for the whole site). */
export function guessCurrency(countryHeader: string | null): Currency {
  return regionalCurrency(countryHeader);
}
