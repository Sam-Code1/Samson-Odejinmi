import type { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Flutterwave webhook. Configure in Flutterwave → Settings → Webhooks:  https://<your-domain>/api/webhooks/flutterwave
 * Set a "Secret hash" there and the same value in FLUTTERWAVE_WEBHOOK_HASH (sent back in the verif-hash header).
 * The payload is never trusted: the reference is re-verified with Flutterwave's API before anything is granted.
 */
export function POST(req: NextRequest) {
  return handlePaymentWebhook("flutterwave", req);
}
