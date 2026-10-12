"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { optStr, str } from "@/lib/admin/validation";

export async function saveAcademySettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
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
