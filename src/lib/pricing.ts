import { defaultPricing, type Currency, type PriceRow } from "@/content/course";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

/** Reads configurable pricing from `course_pricing`, falling back to defaults if unavailable. */
export async function getCoursePricing(courseSlug: string): Promise<PriceRow[]> {
  if (!supabaseConfigured) return defaultPricing;
  try {
    const supabase = await createClient();
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

export function guessCurrency(countryHeader: string | null): Currency {
  const c = countryHeader?.toUpperCase();
  return c === "NG" ? "NGN" : c === "GB" ? "GBP" : "USD";
}
