import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * WhatsApp foundation: provider-agnostic. Ships with the Meta WhatsApp Cloud API (approved templates only, which is
 * what WhatsApp requires for business-initiated messages). Nothing is ever sent unless:
 *   1. a provider is configured (WHATSAPP_PROVIDER=meta + WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID), and
 *   2. the contact opted in to WhatsApp (contacts.whatsapp_opt_in), and
 *   3. marketing messages additionally require the contact's marketing consent.
 * Every attempt is logged in whatsapp_messages with its real status; delivery updates come only from the provider webhook.
 */
export type WaTemplate = { name: string; language: string; variables?: string[] };
export type WaResult = { sent: true; id: string | null } | { sent: false; reason: "not_configured" | "no_opt_in" | "no_consent" | "no_phone" | "failed" };

export interface WhatsAppProvider {
  name: string;
  configured(): boolean;
  sendTemplate(to: string, t: WaTemplate): Promise<{ ok: true; id: string | null } | { ok: false; error: string }>;
}

const meta: WhatsAppProvider = {
  name: "meta",
  configured: () => Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  async sendTemplate(to, t) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) return { ok: false, error: "not configured" };
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to, type: "template",
          template: { name: t.name, language: { code: t.language }, ...(t.variables?.length ? { components: [{ type: "body", parameters: t.variables.map((v) => ({ type: "text", text: v.slice(0, 200) })) }] } : {}) },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true, id: body?.messages?.[0]?.id ?? null };
    } catch {
      return { ok: false, error: "network" };
    }
  },
};

const PROVIDERS: Record<string, WhatsAppProvider> = { meta };

export function getWhatsAppProvider(): WhatsAppProvider | null {
  const p = PROVIDERS[(process.env.WHATSAPP_PROVIDER ?? "").toLowerCase()];
  return p && p.configured() ? p : null;
}

/** Sends a template to a contact, enforcing configuration, opt-in and (for marketing) consent. Logs the outcome. */
export async function sendWhatsAppTemplate(contactId: string, kind: "transactional" | "marketing" | "test", t: WaTemplate): Promise<WaResult> {
  const provider = getWhatsAppProvider();
  if (!provider) return { sent: false, reason: "not_configured" };
  const service = createServiceClient();
  if (!service) return { sent: false, reason: "not_configured" };
  const { data: c } = await service.from("contacts").select("id, phone, whatsapp_opt_in, marketing_consent, unsubscribed_at").eq("id", contactId).maybeSingle();
  if (!c?.phone) return { sent: false, reason: "no_phone" };
  if (!c.whatsapp_opt_in) return { sent: false, reason: "no_opt_in" };
  if (kind === "marketing" && (!c.marketing_consent || c.unsubscribed_at)) return { sent: false, reason: "no_consent" };
  const r = await provider.sendTemplate(c.phone as string, t);
  await service.from("whatsapp_messages").insert({
    contact_id: c.id, to_phone: c.phone, kind, template: t.name.slice(0, 100), provider: provider.name,
    provider_message_id: r.ok ? r.id : null, status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error.slice(0, 300),
  });
  return r.ok ? { sent: true, id: r.id } : { sent: false, reason: "failed" };
}

/** Meta webhook signature: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). */
export function verifyMetaSignature(raw: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}
