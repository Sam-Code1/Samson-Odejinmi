import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Resend (Svix) webhook: HMAC-SHA256 over "id.timestamp.body" with the base64 secret after "whsec_".
 * The signature header may hold several space-separated "v1,<base64>" values. Rejects timestamps older than 5 minutes.
 */
export function verifySvix(body: string, h: { id: string | null; timestamp: string | null; signature: string | null }, secret: string | undefined, now = Date.now()): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  let key: Buffer;
  try { key = Buffer.from(secret.replace(/^whsec_/, ""), "base64"); } catch { return false; }
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${body}`).digest();
  return h.signature.split(" ").some((part) => {
    const [ver, sig] = part.split(",");
    if (ver !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Provider event type → our event, or null for events we don't track. */
export function mapResendEvent(type: unknown): "delivered" | "opened" | "clicked" | "bounced" | "complained" | null {
  switch (type) {
    case "email.delivered": return "delivered";
    case "email.opened": return "opened";
    case "email.clicked": return "clicked";
    case "email.bounced": return "bounced";
    case "email.complained": return "complained";
    default: return null;
  }
}
