import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { PROVIDERS, type ProviderId } from "./providers";
import { fulfilByReference } from "./fulfil";

/** Success events per provider. Everything else is acknowledged and ignored. */
const SUCCESS_EVENTS: Record<ProviderId, string[]> = { paystack: ["charge.success"], flutterwave: ["charge.completed"], palmpay: [] };

async function log(provider: ProviderId, outcome: "processed" | "ignored" | "rejected" | "failed", event?: string | null, reference?: string | null) {
  const service = createServiceClient();
  if (!service) return;
  try {
    await service.from("webhook_events").insert({ provider, outcome, event: event?.slice(0, 80) ?? null, reference: reference ?? null });
    if (outcome === "rejected") await service.from("security_events").insert({ kind: "webhook_rejected", detail: `${provider}: invalid signature` });
  } catch { /* logging never blocks a webhook */ }
}

/**
 * Shared webhook handling for every payment provider:
 *   1. reject anything whose signature doesn't verify (provider-specific check, constant time)
 *   2. never trust the payload: for a success event, re-verify the reference with the provider's API, then fulfil
 *      idempotently (repeated deliveries change nothing)
 *   3. 200 once handled or deliberately ignored; 500 only when we couldn't process it, so the provider retries
 * Every delivery is logged (provider, event, outcome, reference) for System Health and the Security center.
 */
export async function handlePaymentWebhook(providerId: ProviderId, req: NextRequest) {
  const provider = PROVIDERS[providerId];
  const raw = await req.text();
  if (raw.length > 100_000) return new NextResponse("Payload too large", { status: 413 });
  if (!provider.verifyWebhook(raw, req.headers)) { await log(providerId, "rejected"); return new NextResponse("Invalid signature", { status: 401 }); }

  let body: unknown;
  try { body = JSON.parse(raw); } catch { await log(providerId, "failed", "bad json"); return new NextResponse("Bad JSON", { status: 400 }); }
  const evt = provider.parseWebhook(body);
  if (!evt) { await log(providerId, "ignored", "unrecognised"); return NextResponse.json({ received: true, ignored: "unrecognised payload" }); }
  // Only our own references (created by checkout) are handled; anything else on the account is ignored.
  if (!evt.reference) { await log(providerId, "ignored", evt.event); return NextResponse.json({ received: true, ignored: "not an academy reference" }); }
  if (!SUCCESS_EVENTS[providerId].includes(evt.event)) { await log(providerId, "ignored", evt.event, evt.reference); return NextResponse.json({ received: true, ignored: evt.event }); }

  const out = await fulfilByReference(evt.reference);
  if (out.state === "unavailable") { await log(providerId, "failed", evt.event, evt.reference); return new NextResponse("Temporarily unable to process", { status: 500 }); }
  await log(providerId, "processed", evt.event, evt.reference);
  return NextResponse.json({ received: true, state: out.state });
}
