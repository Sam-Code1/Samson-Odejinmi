import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp Cloud API webhook (delivery statuses). Configure in Meta → WhatsApp → Configuration:
 *   Callback URL  https://<your-domain>/api/webhooks/whatsapp
 *   Verify token  WHATSAPP_VERIFY_TOKEN        Signature secret  WHATSAPP_APP_SECRET
 * Only updates messages we sent. Never creates delivery data on its own.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const got = Buffer.from(p.get("hub.verify_token") ?? ""), want = Buffer.from(token ?? "");
  if (!token || p.get("hub.mode") !== "subscribe" || got.length !== want.length || !timingSafeEqual(got, want)) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
}

const STATUSES = new Set(["sent", "delivered", "read", "failed"]);

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 200_000) return new NextResponse("Payload too large", { status: 413 });
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) return new NextResponse("Invalid signature", { status: 401 });
  const service = createServiceClient();
  if (!service) return new NextResponse("Not configured", { status: 500 });
  let body: { entry?: { changes?: { value?: { statuses?: { id?: string; status?: string }[] } }[] }[] };
  try { body = JSON.parse(raw); } catch { return new NextResponse("Bad JSON", { status: 400 }); }
  const updates = (body.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.statuses ?? [])
    .filter((s) => typeof s.id === "string" && STATUSES.has(String(s.status))).slice(0, 100);
  for (const s of updates) await service.from("whatsapp_messages").update({ status: s.status }).eq("provider_message_id", s.id!);
  return NextResponse.json({ received: true, updated: updates.length });
}
