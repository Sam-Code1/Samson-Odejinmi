import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { mapResendEvent, verifySvix } from "@/lib/email/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email provider events (Resend → Webhooks):  https://<your-domain>/api/webhooks/email
 * Subscribe to delivered, opened, clicked, bounced and complained. Secret: RESEND_WEBHOOK_SECRET.
 * Only updates messages we sent (matched by provider message id); never creates metrics on its own.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 200_000) return new NextResponse("Payload too large", { status: 413 });
  const ok = verifySvix(raw, { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, process.env.RESEND_WEBHOOK_SECRET);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  let evt: { type?: unknown; created_at?: unknown; data?: { email_id?: unknown } };
  try { evt = JSON.parse(raw); } catch { return new NextResponse("Bad JSON", { status: 400 }); }
  const type = mapResendEvent(evt.type);
  const id = typeof evt.data?.email_id === "string" ? evt.data.email_id.slice(0, 100) : null;
  if (!type || !id) return NextResponse.json({ received: true, ignored: true });

  const service = createServiceClient();
  if (!service) return new NextResponse("Not configured", { status: 500 });
  const at = typeof evt.created_at === "string" && !Number.isNaN(Date.parse(evt.created_at)) ? evt.created_at : new Date().toISOString();
  const { error } = await service.rpc("record_email_event", { p_provider_id: id, p_type: type, p_at: at });
  if (error) return new NextResponse("Temporarily unable to process", { status: 500 });
  return NextResponse.json({ received: true });
}
