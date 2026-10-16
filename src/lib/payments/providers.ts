import crypto from "node:crypto";
import * as z from "zod/v4";
import { initializeTransaction, paystackConfigured, paystackMode, verifySignature, verifyTransaction } from "./paystack";

/**
 * Provider-agnostic payments. Every provider implements the same interface; checkout, the return page and webhooks
 * talk only to this interface. Whether a payment succeeded is ALWAYS decided by asking the provider's API server to
 * server, then by the database (fulfill_payment checks amount + currency against the stored payment, idempotently).
 *
 *   PaymentProvider
 *   ├── Paystack     (primary)   official REST API, HMAC-SHA512 webhooks
 *   ├── Flutterwave  (secondary) official v3 REST API, secret-hash webhooks
 *   └── PalmPay      (future)    placeholder: never configured until an official merchant API is verified
 *
 * Secrets come only from server environment variables. Nothing here runs in the browser.
 */
export const METHODS = ["card", "bank", "bank_transfer", "ussd", "qr", "mobile_money", "opay", "apple_pay"] as const;
export type MethodId = (typeof METHODS)[number];
export const METHOD_LABELS: Record<MethodId, string> = {
  card: "Card", bank: "Bank account", bank_transfer: "Bank transfer", ussd: "USSD", qr: "Scan to pay (QR)", mobile_money: "Mobile money", opay: "OPay", apple_pay: "Apple Pay",
};
/** Methods that only make sense for buyers in Nigeria (local bank rails / wallets). */
export const NIGERIA_ONLY: MethodId[] = ["bank", "bank_transfer", "ussd", "qr", "opay"];

export type ProviderId = "paystack" | "flutterwave" | "palmpay";
export type TxStatus = "success" | "failed" | "pending" | "abandoned" | "reversed";
export type NormalizedTx = { status: TxStatus; reference: string; amountMinor: number; currency: string; paidAt: string | null; channel: string | null; transactionId: string | null };
export type InitOptions = { email: string; amountMinor: number; currency: string; reference: string; callbackUrl: string; metadata: Record<string, string>; methods: MethodId[] };
export type WebhookResult = { event: string; reference: string | null };

export interface PaymentProvider {
  id: ProviderId;
  name: string;
  configured(): boolean;
  mode(): "test" | "live" | null;
  /** What the provider can process, per currency (from the provider's documentation). Account settings may narrow it. */
  supports: Partial<Record<string, MethodId[]>>;
  /** Returns the provider's hosted checkout URL, or null. */
  initialize(o: InitOptions): Promise<string | null>;
  verify(reference: string): Promise<NormalizedTx | null>;
  verifyWebhook(raw: string, headers: Headers): boolean;
  parseWebhook(body: unknown): WebhookResult | null;
  /** Refund state for a transaction where the provider exposes it; null when unknown. */
  refundStatus?(transactionId: string): Promise<"none" | "pending" | "processed" | "failed" | null>;
  /** Cheap authenticated call for System Health. */
  ping(): Promise<boolean>;
}

const REF = /^FA-\d{6}-[A-F0-9]{12}$/;
const minor = (major: number) => Math.round(major * 100);

// ───────────── Paystack ─────────────
const PAYSTACK_CHANNEL: Record<MethodId, string> = { card: "card", bank: "bank", bank_transfer: "bank_transfer", ussd: "ussd", qr: "qr", mobile_money: "mobile_money", opay: "opay", apple_pay: "apple_pay" };

const paystack: PaymentProvider = {
  id: "paystack",
  name: "Paystack",
  configured: paystackConfigured,
  mode: paystackMode,
  supports: { NGN: ["card", "bank", "bank_transfer", "ussd", "qr"], USD: ["card", "apple_pay"], GHS: ["card", "mobile_money"], KES: ["card", "mobile_money"], ZAR: ["card"] },
  async initialize(o) {
    return initializeTransaction({ ...o, channels: o.methods.map((m) => PAYSTACK_CHANNEL[m]) });
  },
  async verify(reference) {
    const tx = await verifyTransaction(reference);
    if (!tx) return null;
    const s = tx.status;
    return {
      status: s === "success" ? "success" : s === "failed" ? "failed" : s === "abandoned" ? "abandoned" : s === "reversed" ? "reversed" : "pending",
      reference: tx.reference, amountMinor: tx.requested_amount ?? tx.amount, currency: tx.currency, paidAt: tx.paid_at ?? null, channel: tx.channel ?? null,
      transactionId: tx.id != null ? String(tx.id) : null,
    };
  },
  verifyWebhook: (raw, h) => verifySignature(raw, h.get("x-paystack-signature")),
  parseWebhook(body) {
    const b = body as { event?: unknown; data?: { reference?: unknown } };
    if (typeof b?.event !== "string") return null;
    return { event: b.event, reference: typeof b.data?.reference === "string" && REF.test(b.data.reference) ? b.data.reference : null };
  },
  async refundStatus(transactionId) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key || !/^\d{1,20}$/.test(transactionId)) return null;
    try {
      const res = await fetch(`https://api.paystack.co/refund?transaction=${transactionId}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const body = (await res.json().catch(() => null)) as { data?: { status?: string }[] } | null;
      if (!res.ok || !Array.isArray(body?.data)) return null;
      if (!body!.data.length) return "none";
      const st = body!.data[0].status ?? "";
      return st === "processed" ? "processed" : st === "failed" ? "failed" : "pending";
    } catch { return null; }
  },
  async ping() {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return false;
    try {
      const res = await fetch("https://api.paystack.co/transaction?perPage=1", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      return res.ok;
    } catch { return false; }
  },
};

// ───────────── Flutterwave (v3) ─────────────
const FLW_API = "https://api.flutterwave.com/v3";
const flwKey = () => process.env.FLUTTERWAVE_SECRET_KEY;
function flwOption(m: MethodId, currency: string): string | null {
  switch (m) {
    case "card": return "card";
    case "bank_transfer": return "banktransfer";
    case "ussd": return "ussd";
    case "opay": return "opay";
    case "qr": return "nqr";
    case "bank": return "account";
    case "mobile_money": return currency === "GHS" ? "mobilemoneyghana" : currency === "KES" ? "mpesa" : null;
    default: return null;
  }
}
const FlwInit = z.object({ status: z.literal("success"), data: z.object({ link: z.string().url() }) });
const FlwVerify = z.object({
  status: z.string(),
  data: z.object({ id: z.union([z.number(), z.string()]), tx_ref: z.string(), status: z.string(), amount: z.number(), currency: z.string(), payment_type: z.string().nullish(), created_at: z.string().nullish() }).nullish(),
});

const flutterwave: PaymentProvider = {
  id: "flutterwave",
  name: "Flutterwave",
  configured: () => Boolean(flwKey()),
  mode: () => { const k = flwKey() ?? ""; return k.includes("_TEST") ? "test" : k ? "live" : null; },
  supports: { NGN: ["card", "bank_transfer", "ussd", "opay", "qr", "bank"], USD: ["card"], GBP: ["card"], EUR: ["card"], GHS: ["card", "mobile_money"], KES: ["card", "mobile_money"] },
  async initialize(o) {
    const key = flwKey();
    if (!key) return null;
    const options = [...new Set(o.methods.map((m) => flwOption(m, o.currency)).filter(Boolean))].join(",");
    try {
      const res = await fetch(`${FLW_API}/payments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_ref: o.reference, amount: o.amountMinor / 100, currency: o.currency, redirect_url: o.callbackUrl, payment_options: options || "card",
          customer: { email: o.email }, customizations: { title: "Fola Academy" }, meta: o.metadata,
        }),
        cache: "no-store", signal: AbortSignal.timeout(20_000),
      });
      const parsed = FlwInit.safeParse(await res.json().catch(() => null));
      if (!res.ok || !parsed.success) { console.error("[flutterwave] initialize failed:", res.status); return null; }
      const url = new URL(parsed.data.data.link);
      // Only ever send buyers to Flutterwave's own checkout.
      if (url.protocol !== "https:" || !/(^|\.)flutterwave\.com$/.test(url.hostname)) return null;
      return url.toString();
    } catch { return null; }
  },
  async verify(reference) {
    const key = flwKey();
    if (!key || !REF.test(reference)) return null;
    try {
      const res = await fetch(`${FLW_API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const parsed = FlwVerify.safeParse(await res.json().catch(() => null));
      // No transaction yet (buyer hasn't paid) is "pending", not an error.
      if (res.status === 404 || (parsed.success && !parsed.data.data)) return { status: "pending", reference, amountMinor: 0, currency: "", paidAt: null, channel: null, transactionId: null };
      if (!res.ok || !parsed.success || !parsed.data.data) { console.error("[flutterwave] verify failed:", res.status); return null; }
      const d = parsed.data.data;
      if (d.tx_ref !== reference) return null;
      const st = d.status.toLowerCase();
      return {
        status: st === "successful" ? "success" : st === "failed" ? "failed" : st === "cancelled" ? "abandoned" : "pending",
        reference, amountMinor: minor(d.amount), currency: d.currency, paidAt: d.created_at ?? null, channel: d.payment_type ?? null, transactionId: String(d.id),
      };
    } catch { return null; }
  },
  // Flutterwave sends the "secret hash" you set in its dashboard in the `verif-hash` header.
  verifyWebhook(_raw, h) {
    const want = process.env.FLUTTERWAVE_WEBHOOK_HASH, got = h.get("verif-hash");
    if (!want || !got) return false;
    const a = Buffer.from(got), b = Buffer.from(want);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },
  parseWebhook(body) {
    const b = body as { event?: unknown; data?: { tx_ref?: unknown } };
    if (typeof b?.event !== "string") return null;
    return { event: b.event, reference: typeof b.data?.tx_ref === "string" && REF.test(b.data.tx_ref) ? b.data.tx_ref : null };
  },
  async ping() {
    const key = flwKey();
    if (!key) return false;
    try {
      const res = await fetch(`${FLW_API}/balances`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      return res.ok;
    } catch { return false; }
  },
};

// ───────────── PalmPay (future) ─────────────
// Deliberately inert. Add a real implementation only after confirming an official, documented merchant checkout API
// and credentials for this business. No unofficial APIs, no scraping.
const palmpay: PaymentProvider = {
  id: "palmpay", name: "PalmPay", configured: () => false, mode: () => null, supports: {},
  initialize: async () => null, verify: async () => null, verifyWebhook: () => false, parseWebhook: () => null, ping: async () => false,
};

export const PROVIDERS: Record<ProviderId, PaymentProvider> = { paystack, flutterwave, palmpay };
export const isProviderId = (v: unknown): v is ProviderId => typeof v === "string" && v in PROVIDERS;
export const isMethod = (v: unknown): v is MethodId => typeof v === "string" && (METHODS as readonly string[]).includes(v);
