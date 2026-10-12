import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod/v4";
import { verifySignature } from "@/lib/payments/paystack";
import { fulfilByReference } from "@/lib/payments/fulfil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Event = z.object({ event: z.string(), data: z.object({ reference: z.string().max(100) }).passthrough() });

/**
 * Paystack webhook. Configure in Paystack → Settings → API Keys & Webhooks:  https://<your-domain>/api/webhooks/paystack
 *
 * 1. Reject anything whose HMAC-SHA512 signature doesn't match (raw body, secret key).
 * 2. For charge.success, never trust the payload: re-verify the reference with Paystack, then fulfil idempotently.
 * 3. Return 200 once handled (or deliberately ignored); 500 only when we couldn't process it, so Paystack retries.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 100_000) return new NextResponse("Payload too large", { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-paystack-signature"))) return new NextResponse("Invalid signature", { status: 401 });

  let parsed;
  try { parsed = Event.safeParse(JSON.parse(raw)); } catch { return new NextResponse("Bad JSON", { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ received: true, ignored: "unrecognised payload" });

  const { event, data } = parsed.data;
  // Only our own references (created by create_checkout) are handled; anything else on the account is ignored.
  if (!/^FA-\d{6}-[A-F0-9]{12}$/.test(data.reference)) return NextResponse.json({ received: true, ignored: "not an academy reference" });

  if (event === "charge.success") {
    const out = await fulfilByReference(data.reference);
    if (out.state === "unavailable") return new NextResponse("Temporarily unable to process", { status: 500 });
    return NextResponse.json({ received: true, state: out.state });
  }
  return NextResponse.json({ received: true, ignored: event });
}
