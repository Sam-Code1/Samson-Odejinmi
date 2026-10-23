"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { optStr, str } from "@/lib/admin/validation";
import { resolveImageField } from "@/lib/admin/storage";
import { logActivity } from "@/lib/admin/activity";

export async function saveAcademySettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("settings", async ({ supabase }) => {
    const academy_name = str(fd, "academy_name", 80);
    const support_email = str(fd, "support_email", 200);
    const currency = str(fd, "default_currency", 3).toUpperCase();
    const fieldErrors: Record<string, string> = {};
    if (!academy_name) fieldErrors.academy_name = "Academy name is required.";
    if (support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support_email)) fieldErrors.support_email = "Enter a valid email address.";
    if (!["NGN", "USD", "GBP"].includes(currency)) fieldErrors.default_currency = "Choose a currency.";
    const tz = str(fd, "timezone", 60);
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { fieldErrors.timezone = "Enter a valid timezone, for example Africa/Lagos."; }
    const provider = str(fd, "default_video_provider", 12) || "youtube";
    if (!["youtube", "bunny", "mux", "cloudflare"].includes(provider)) fieldErrors.default_video_provider = "Choose a provider.";
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const { error } = await supabase.from("academy_settings").update({
      academy_name, description: optStr(fd, "description", 400), support_email: support_email || null, default_currency: currency, timezone: tz, default_video_provider: provider,
    }).eq("id", true);
    if (error) return dbError(error);
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  });
}

/**
 * Certificate design: who signs every certificate, and their signature image (optional, PNG with a transparent
 * background works best). Settings permission only: a signature is sensitive. Applies to every certificate,
 * including ones already issued (they're rendered from the record when viewed).
 */
export async function saveCertificateDesign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("settings", async (ctx) => {
    const name = str(fd, "certificate_signatory_name", 80);
    const title = str(fd, "certificate_signatory_title", 80);
    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.certificate_signatory_name = "Enter the name that signs certificates.";
    if (!title) fieldErrors.certificate_signatory_title = "Enter their title, e.g. Founder, Fola Academy.";
    const sig = await resolveImageField(ctx, fd, "signature", "site_image");
    if (!sig.ok) fieldErrors.signature = sig.error;
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
    const patch: Record<string, unknown> = { certificate_signatory_name: name, certificate_signatory_title: title };
    if (sig.ok && sig.url !== undefined) patch.certificate_signature_url = sig.url;
    const { error } = await ctx.supabase.from("academy_settings").update(patch).eq("id", true);
    if (error) return dbError(error, "Couldn't save. Run migration 0017 in Supabase first.");
    await logActivity(ctx, "certificate design updated", "academy_settings", null, name);
    revalidatePath("/admin/certificates");
    revalidatePath("/admin/certificates/preview");
    return { ok: true, message: "Certificate design saved. Every certificate now shows it." };
  });
}
