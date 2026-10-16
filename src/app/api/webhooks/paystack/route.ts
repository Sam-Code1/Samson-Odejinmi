import type { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paystack webhook. Configure in Paystack → Settings → API Keys & Webhooks:  https://<your-domain>/api/webhooks/paystack
 * Signature: HMAC-SHA512 of the raw body with PAYSTACK_SECRET_KEY (x-paystack-signature). See lib/payments/webhook.ts.
 */
export function POST(req: NextRequest) {
  return handlePaymentWebhook("paystack", req);
}
