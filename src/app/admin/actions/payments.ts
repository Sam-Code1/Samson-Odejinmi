"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";
import { fulfilByReference } from "@/lib/payments/fulfil";

/**
 * Payment records are written by the server after Paystack verification. Admins can't edit amounts or mark a payment
 * as paid. Two operational actions exist, both "payments" permission (Owner / Super Admin):
 *  - re-check a pending payment with Paystack (same verified path as the webhook)
 *  - record a refund that was already made in the Paystack dashboard (removes course access)
 */
export async function recheckPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("payments", async (ctx) => {
    const reference = str(fd, "reference", 60);
    if (!/^FA-\d{6}-[A-F0-9]{12}$/.test(reference)) return { ok: false, error: "That reference isn't valid." };
    const out = await fulfilByReference(reference);
    await logActivity(ctx, "payment re-checked", "payment", null, reference, { result: out.state });
    revalidatePath("/admin/payments");
    if (out.state === "fulfilled") return { ok: true, message: out.already ? "Already confirmed." : "Confirmed by Paystack. The student is enrolled." };
    if (out.state === "failed") return { ok: true, message: `Paystack reports this payment as ${out.reason.replace(/_/g, " ")}.` };
    if (out.state === "pending") return { ok: true, message: "Still pending at Paystack." };
    return { ok: false, error: out.reason === "no_service_key" ? "SUPABASE_SERVICE_ROLE_KEY isn't set on the server, so payments can't be confirmed." : "Paystack couldn't be reached. Try again shortly." };
  });
}

export async function recordRefund(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("payments", async (ctx) => {
    const id = str(fd, "paymentId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing payment." };
    const { error } = await ctx.supabase.rpc("admin_record_refund", { p_payment: id });
    if (error) return /only successful/i.test(error.message) ? { ok: false, error: "Only successful payments can be marked refunded." } : dbError(error);
    await logActivity(ctx, "payment status changed", "payment", id, null, { status: "refunded" });
    revalidatePath("/admin/payments");
    revalidatePath("/admin/enrolments");
    return { ok: true, message: "Recorded as refunded. The student's access to the course was removed." };
  });
}
