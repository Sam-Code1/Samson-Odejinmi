import crypto from "node:crypto";
import * as z from "zod/v4";

/**
 * Paystack, server-side only. The secret key comes from PAYSTACK_SECRET_KEY and never reaches the browser.
 * Contract (Paystack docs): POST /transaction/initialize (amount in the currency's subunit),
 * GET /transaction/verify/:reference, webhooks signed with HMAC-SHA512 of the raw body in `x-paystack-signature`.
 */
const API = "https://api.paystack.co";

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/** Currencies your Paystack account can accept. Defaults to NGN; set PAYSTACK_CURRENCIES=NGN,USD if USD is enabled. */
export function payableCurrencies(): string[] {
  return (process.env.PAYSTACK_CURRENCIES ?? "NGN").split(",").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c));
}

export function paystackMode(): "test" | "live" | null {
  const k = process.env.PAYSTACK_SECRET_KEY ?? "";
  return k.startsWith("sk_test_") ? "test" : k.startsWith("sk_live_") ? "live" : k ? null : null;
}

async function call(path: string, init?: RequestInit) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

const InitResponse = z.object({ status: z.literal(true), data: z.object({ authorization_url: z.string().url(), reference: z.string() }) });

export async function initializeTransaction(o: { email: string; amountMinor: number; currency: string; reference: string; callbackUrl: string; metadata: Record<string, string>; channels?: string[] }) {
  const r = await call("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: o.email, amount: String(o.amountMinor), currency: o.currency, reference: o.reference, callback_url: o.callbackUrl, metadata: JSON.stringify(o.metadata),
      // Restricts Paystack's checkout to the method the buyer chose (omitted = Paystack shows everything enabled on the account).
      ...(o.channels?.length ? { channels: o.channels } : {}),
    }),
  });
  const parsed = InitResponse.safeParse(r.body);
  if (!r.ok || !parsed.success) {
    console.error("[paystack] initialize failed:", r.status, (r.body as { message?: string } | null)?.message);
    return null;
  }
  const url = new URL(parsed.data.data.authorization_url);
  // Only ever send students to Paystack's own checkout.
  if (url.protocol !== "https:" || !/(^|\.)paystack\.(com|co)$/.test(url.hostname)) return null;
  return url.toString();
}

const VerifyResponse = z.object({
  status: z.boolean(),
  data: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    status: z.string(),
    reference: z.string(),
    amount: z.number(),
    requested_amount: z.number().nullish(),
    currency: z.string(),
    paid_at: z.string().nullish(),
    channel: z.string().nullish(),
  }),
});
export type VerifiedTransaction = z.infer<typeof VerifyResponse>["data"];

/** Asks Paystack directly. This, never a redirect or query string, is what decides whether a payment succeeded. */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  if (!/^[A-Za-z0-9.=-]{6,100}$/.test(reference)) return null;
  const r = await call(`/transaction/verify/${encodeURIComponent(reference)}`);
  const parsed = VerifyResponse.safeParse(r.body);
  if (!r.ok || !parsed.success || !parsed.data.status) {
    console.error("[paystack] verify failed:", r.status);
    return null;
  }
  return parsed.data.data;
}

/** Constant-time check of `x-paystack-signature` (HMAC-SHA512 of the raw body, keyed with the secret key). */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha512", key).update(rawBody, "utf8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature.toLowerCase(), "hex"));
}
