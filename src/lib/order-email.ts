import { createServiceClient } from "@/lib/supabase/admin";
import { sendEmail, templates } from "@/lib/email";
import { formatMoney } from "@/lib/utils";
import { siteBaseUrl } from "@/lib/checkout";
import { site } from "@/lib/site";
import { issueOrderToken, trackCommerce } from "@/lib/orders";

/**
 * Order confirmation (shop checkout: guests and accounts). Called exactly once per order: when the database first
 * marks it paid (fulfilment is idempotent and reports `already` on repeats), or right after a free order is created.
 * The email carries a NEW private access token for this order (separate from the browser's), so the buyer can get back
 * to their downloads from any device. Guests are offered (never required) an account; courses need one to start.
 */
export async function sendOrderConfirmation(paymentId: string) {
  const service = createServiceClient();
  if (!service) return;
  const { data: p } = await service.from("payments").select("id, order_number, user_id, guest_email, customer_name, amount_minor, currency, provider").eq("id", paymentId).maybeSingle();
  if (!p) return;
  const { data: items } = await service.from("payment_items").select("name, course_id, products(product_type)").eq("payment_id", paymentId);
  const list = (items ?? []) as unknown as { name: string; course_id: string | null; products: { product_type: string } | null }[];
  let email = p.guest_email as string | null;
  let name = (p.customer_name as string | null) ?? "";
  if (p.user_id) {
    const { data: prof } = await service.from("profiles").select("first_name, email").eq("id", p.user_id as string).maybeSingle();
    email = (prof?.email as string | null) ?? email;
    name = name || ((prof?.first_name as string | null) ?? "");
  }
  await trackCommerce("purchase_completed", { paymentId, currency: p.currency as string, provider: p.provider as string, guest: !p.user_id });
  if (!email) return;
  const token = await issueOrderToken(paymentId, "email");
  if (!token) return;
  const base = await siteBaseUrl().catch(() => site.url);
  const amount = Number(p.amount_minor) === 0 ? "Free" : formatMoney(Number(p.amount_minor), p.currency as string);
  const res = await sendEmail({
    to: email,
    ...templates.order({
      name, orderNumber: p.order_number as string, items: list.map((i) => i.name), amount, guest: !p.user_id,
      orderUrl: `${base}/order/${token}`, claimUrl: p.user_id ? null : `${base}/claim?t=${token}`,
      hasCourse: list.some((i) => i.course_id || i.products?.product_type === "course"),
    }),
  }, "transactional");
  if (!res.sent) console.warn("[email] order confirmation not sent:", res.reason);
}
