"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";
import { PROVIDERS, isMethod, isProviderId } from "@/lib/payments/providers";

/**
 * Payment provider settings ("payments" permission: Owner / Super Admin). Only configuration is stored (enabled,
 * priority, currencies, methods). Secret keys are never accepted here: they live in server environment variables.
 */
export async function savePaymentProvider(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("payments", async (ctx) => {
    const id = str(fd, "providerId", 20);
    if (!isProviderId(id)) return { ok: false, error: "Unknown provider." };
    const p = PROVIDERS[id];
    const supportedCur = Object.keys(p.supports);
    const supportedMethods = new Set(Object.values(p.supports).flat());
    const currencies = [...new Set(fd.getAll("currencies").map(String))].filter((c) => supportedCur.includes(c));
    const methods = [...new Set(fd.getAll("methods").map(String))].filter((m) => isMethod(m) && supportedMethods.has(m));
    const priority = Number(str(fd, "priority", 5));
    const enabled = fd.get("enabled") === "on";
    const errors: Record<string, string> = {};
    if (!Number.isInteger(priority) || priority < 0 || priority > 1000) errors.priority = "Use a whole number from 0 to 1000 (lower runs first).";
    if (enabled && id === "palmpay") errors.enabled = "PalmPay can't be enabled until an official merchant integration is added.";
    if (enabled && (!currencies.length || !methods.length)) errors.enabled = "Choose at least one currency and one method before enabling.";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { data: before } = await ctx.supabase.from("payment_providers").select("enabled, priority, currencies, methods").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("payment_providers").update({ enabled, priority, currencies, methods, updated_by: ctx.user.id }).eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "payment provider updated", "payment_provider", id, p.name, {
      enabled, priority, currencies: currencies.join(","), methods: methods.join(","), was_enabled: before?.enabled === true,
    });
    revalidateTag("cms");
    revalidatePath("/admin/settings/payments");
    return { ok: true, message: enabled && !p.configured() ? `Saved. ${p.name} is enabled but its keys aren't set on the server yet, so checkout won't offer it.` : "Saved." };
  });
}

/** Forgets what a provider's account answered for a currency, so checkout offers and tries it again. */
export async function clearCapability(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("payments", async (ctx) => {
    const provider = str(fd, "provider", 20), mode = str(fd, "mode", 4), currency = str(fd, "currency", 3);
    if (!isProviderId(provider) || !["test", "live"].includes(mode) || !/^[A-Z]{3}$/.test(currency)) return { ok: false, message: "Invalid request." };
    const { error } = await ctx.supabase.from("payment_provider_capabilities").delete().eq("provider", provider).eq("mode", mode).eq("currency", currency);
    if (error) return dbError(error, "Couldn't clear. Run migration 0012 first.");
    await logActivity(ctx, "payment capability cleared", "payment_provider", provider, `${PROVIDERS[provider].name} ${currency} (${mode})`);
    revalidateTag("cms");
    revalidatePath("/admin/settings/payments");
    return { ok: true, message: `${currency} will be tried again on ${PROVIDERS[provider].name} at the next checkout.` };
  });
}

/**
 * TEST MODE ONLY: asks the provider's test account, for each currency allowed in settings, whether it would start a
 * transaction (nothing can be charged in test mode). Live accounts are learned from real checkouts instead, so no
 * abandoned transactions are created on the live dashboard.
 */
export async function checkCapabilities(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("payments", async (ctx) => {
    const provider = str(fd, "provider", 20);
    if (!isProviderId(provider)) return { ok: false, message: "Invalid provider." };
    const p = PROVIDERS[provider];
    if (!p.configured()) return { ok: false, message: `${p.name}'s keys aren't set on the server.` };
    if (p.mode() !== "test") return { ok: false, message: "Live accounts are checked at real checkouts (a test transaction would show on your live dashboard). Use Re-check to retry a currency." };
    const { data: row } = await ctx.supabase.from("payment_providers").select("currencies").eq("id", provider).maybeSingle();
    const currencies = ((row?.currencies as string[] | null) ?? []).filter((c) => c in p.supports);
    if (!currencies.length) return { ok: false, message: "No currencies are allowed for this provider in settings." };
    const { recordCapability } = await import("@/lib/payments/capabilities");
    const results: string[] = [];
    for (const currency of currencies) {
      const reference = `FA-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      const r = await p.initialize({ email: "capability-check@example.com", amountMinor: 10000, currency, reference, callbackUrl: "https://example.com/capability-check", metadata: { purpose: "capability_check" }, methods: [...(p.supports[currency] ?? []).slice(0, 1)] });
      if (r.ok) { await recordCapability(provider, "test", currency, "supported"); results.push(`${currency} accepted`); }
      else if (r.reason === "unsupported_currency") { await recordCapability(provider, "test", currency, "unsupported", r.detail); results.push(`${currency} refused`); }
      else results.push(`${currency} couldn't be checked`);
    }
    await logActivity(ctx, "payment capabilities checked", "payment_provider", provider, p.name, { results: results.join(", ") });
    revalidatePath("/admin/settings/payments");
    return { ok: true, message: `${p.name} (test account): ${results.join(", ")}.` };
  });
}
