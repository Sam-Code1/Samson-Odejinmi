import { cache } from "react";
import { revalidateTag } from "next/cache";
import { contentClient } from "@/lib/cms";
import { supabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ProviderId } from "./providers";

/**
 * What each connected merchant account has actually accepted or refused, per currency and key mode (migration 0012).
 * Learned from real provider answers at checkout (and from Admin → Payments → "Check"), never assumed:
 *   - a refusal (e.g. Paystack 403 `unsupported_currency`) marks the pair 'unsupported': checkout stops offering it
 *     and routes to another provider that can take the currency;
 *   - an accepted transaction marks it 'supported'.
 * Test and live accounts are tracked separately because their capabilities differ.
 */
export type CapabilityStatus = "supported" | "unsupported";
export type Capability = { provider: ProviderId; mode: "test" | "live"; currency: string; status: CapabilityStatus; detail: string | null; checkedAt: string };

export const capKey = (provider: string, mode: string | null, currency: string) => `${provider}:${mode ?? "?"}:${currency}`;

export const getCapabilities = cache(async (): Promise<Capability[]> => {
  if (!supabaseConfigured) return [];
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.from("payment_provider_capabilities").select("provider, mode, currency, status, detail, checked_at");
    if (error || !data) return []; // before 0012: nothing learned yet
    return (data as Record<string, unknown>[]).map((r) => ({
      provider: r.provider as ProviderId, mode: r.mode as "test" | "live", currency: String(r.currency), status: r.status as CapabilityStatus,
      detail: (r.detail as string | null) ?? null, checkedAt: String(r.checked_at),
    }));
  } catch {
    return [];
  }
});

/** Keys of provider/mode/currency pairs the merchant account refused. */
export async function getUnsupported(): Promise<Set<string>> {
  return new Set((await getCapabilities()).filter((c) => c.status === "unsupported").map((c) => capKey(c.provider, c.mode, c.currency)));
}

/** Records a real provider answer. Server-only (service role); silently skipped when the key or table is missing. */
export async function recordCapability(provider: ProviderId, mode: "test" | "live" | null, currency: string, status: CapabilityStatus, detail?: string) {
  if (!mode || !/^[A-Z]{3}$/.test(currency)) return;
  const service = createServiceClient();
  if (!service) return;
  const { error } = await service.from("payment_provider_capabilities").upsert(
    { provider, mode, currency, status, detail: detail?.slice(0, 300) ?? null, checked_at: new Date().toISOString() },
    { onConflict: "provider,mode,currency" },
  );
  if (error) { if (error.code !== "42P01" && error.code !== "PGRST205") console.warn("[payments] capability not recorded:", error.code); return; }
  try { revalidateTag("cms"); } catch { /* outside a request: next read is fresh anyway */ }
}
