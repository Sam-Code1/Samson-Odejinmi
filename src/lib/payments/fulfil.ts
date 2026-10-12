import { createServiceClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "./paystack";
import { sendEmail, templates } from "@/lib/email";
import { formatMoney } from "@/lib/utils";

export type FulfilOutcome =
  | { state: "fulfilled"; already: boolean; courseId: string | null }
  | { state: "pending" }
  | { state: "failed"; reason: string }
  | { state: "unavailable"; reason: "no_service_key" | "verify_failed" };

/**
 * The ONLY path that turns a payment into course access. Used by both the webhook and the return page:
 *   1. ask Paystack for the transaction (server to server)
 *   2. if it succeeded, call fulfill_payment() with the service role. The database checks the amount and currency
 *      against the stored payment and is idempotent, so repeats never duplicate payments, enrolments or redemptions.
 */
export async function fulfilByReference(reference: string): Promise<FulfilOutcome> {
  const service = createServiceClient();
  if (!service) {
    console.error("[payments] SUPABASE_SERVICE_ROLE_KEY is missing: cannot fulfil", reference);
    return { state: "unavailable", reason: "no_service_key" };
  }
  const tx = await verifyTransaction(reference);
  if (!tx) return { state: "unavailable", reason: "verify_failed" };

  if (tx.status === "success") {
    const { data, error } = await service.rpc("fulfill_payment", {
      p_reference: tx.reference, p_amount: tx.requested_amount ?? tx.amount, p_currency: tx.currency,
      p_paid_at: tx.paid_at ?? null, p_channel: tx.channel ?? null, p_transaction_id: tx.id != null ? String(tx.id) : null,
    });
    const r = data as { ok: boolean; already?: boolean; error?: string; course_id?: string; user_id?: string; payment_id?: string } | null;
    if (error || !r) { console.error("[payments] fulfill_payment error:", error?.code, error?.message); return { state: "unavailable", reason: "verify_failed" }; }
    if (!r.ok) return { state: "failed", reason: r.error ?? "unknown" };
    if (!r.already && r.user_id && r.course_id) await sendPurchaseEmail(service, r.user_id, r.course_id, reference);
    return { state: "fulfilled", already: Boolean(r.already), courseId: r.course_id ?? null };
  }
  if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    await service.rpc("mark_payment_failed", { p_reference: tx.reference, p_reason: tx.status });
    return { state: "failed", reason: tx.status };
  }
  return { state: "pending" };
}

async function sendPurchaseEmail(service: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, courseId: string, reference: string) {
  const [{ data: p }, { data: c }, { data: pay }] = await Promise.all([
    service.from("profiles").select("first_name, email").eq("id", userId).maybeSingle(),
    service.from("courses").select("title, slug").eq("id", courseId).maybeSingle(),
    service.from("payments").select("amount_minor, currency").eq("reference", reference).maybeSingle(),
  ]);
  if (!p?.email || !c) return;
  const t = templates.purchase({ name: p.first_name as string, course: c.title as string, slug: c.slug as string, reference, amount: pay ? formatMoney(pay.amount_minor as number, pay.currency as string) : "" });
  const res = await sendEmail({ to: p.email as string, ...t });
  if (!res.sent) console.warn("[email] purchase confirmation not sent:", res.reason);
}
