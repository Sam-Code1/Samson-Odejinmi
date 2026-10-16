import { createServiceClient } from "@/lib/supabase/admin";
import { PROVIDERS, isProviderId } from "./providers";
import { sendEmail, templates } from "@/lib/email";
import { formatMoney } from "@/lib/utils";

export type FulfilOutcome =
  | { state: "fulfilled"; already: boolean; courseId: string | null }
  | { state: "pending" }
  | { state: "failed"; reason: string }
  | { state: "unavailable"; reason: "no_service_key" | "verify_failed" };

/**
 * The ONLY path that turns a payment into access. Used by every provider's webhook and by the return page:
 *   1. look up which provider the payment belongs to (stored on the payment by checkout)
 *   2. ask THAT provider for the transaction (server to server)
 *   3. if it succeeded, call fulfill_payment() with the service role. The database checks the amount and currency
 *      against the stored payment and is idempotent, so repeats never duplicate payments, enrolments or redemptions.
 */
export async function fulfilByReference(reference: string): Promise<FulfilOutcome> {
  const service = createServiceClient();
  if (!service) {
    console.error("[payments] SUPABASE_SERVICE_ROLE_KEY is missing: cannot fulfil", reference);
    return { state: "unavailable", reason: "no_service_key" };
  }
  const { data: pay } = await service.from("payments").select("provider").eq("reference", reference).maybeSingle();
  const providerId = isProviderId(pay?.provider) ? pay!.provider : "paystack";
  const tx = await PROVIDERS[providerId].verify(reference);
  if (!tx) return { state: "unavailable", reason: "verify_failed" };

  if (tx.status === "success") {
    const { data, error } = await service.rpc("fulfill_payment", {
      p_reference: reference, p_amount: tx.amountMinor, p_currency: tx.currency,
      p_paid_at: tx.paidAt, p_channel: tx.channel, p_transaction_id: tx.transactionId,
    });
    const r = data as { ok: boolean; already?: boolean; error?: string; course_id?: string; user_id?: string; payment_id?: string; product_id?: string | null } | null;
    if (error || !r) { console.error("[payments] fulfill_payment error:", error?.code, error?.message); return { state: "unavailable", reason: "verify_failed" }; }
    if (!r.ok) return { state: "failed", reason: r.error ?? "unknown" };
    if (!r.already && r.user_id && r.product_id) await sendProductEmail(service, r.user_id, r.product_id, reference);
    else if (!r.already && r.user_id && r.course_id) await sendPurchaseEmail(service, r.user_id, r.course_id, reference);
    return { state: "fulfilled", already: Boolean(r.already), courseId: r.course_id ?? null };
  }
  if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    await service.rpc("mark_payment_failed", { p_reference: reference, p_reason: tx.status });
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

async function sendProductEmail(service: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, productId: string, reference: string) {
  const [{ data: p }, { data: pr }, { data: pay }] = await Promise.all([
    service.from("profiles").select("first_name, email").eq("id", userId).maybeSingle(),
    service.from("products").select("name, product_type, courses(slug)").eq("id", productId).maybeSingle(),
    service.from("payments").select("amount_minor, currency").eq("reference", reference).maybeSingle(),
  ]);
  if (!p?.email || !pr) return;
  const course = (pr as { courses?: { slug?: string } | null }).courses;
  const t = templates.productPurchase({ name: p.first_name as string, product: pr.name as string, reference, courseSlug: course?.slug ?? null, amount: pay ? formatMoney(pay.amount_minor as number, pay.currency as string) : "" });
  const res = await sendEmail({ to: p.email as string, ...t });
  if (!res.sent) console.warn("[email] product confirmation not sent:", res.reason);
}
