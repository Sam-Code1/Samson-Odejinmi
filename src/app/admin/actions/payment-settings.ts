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
