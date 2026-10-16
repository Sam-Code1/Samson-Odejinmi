/**
 * Email provider abstraction. The app talks to `EmailProvider`; Resend is the implementation shipped today.
 * Add another provider by implementing the interface and selecting it with EMAIL_PROVIDER.
 */
export type OutgoingEmail = {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
  replyTo?: string;
  bcc?: string[];
  /** Provider tags for reporting (letters, digits, _ and -). */
  tags?: { name: string; value: string }[];
};
export type SendResult = { sent: true; id: string | null } | { sent: false; reason: "not_configured" | "failed" | "rejected"; detail?: string };

export interface EmailProvider {
  name: string;
  configured(): boolean;
  send(msg: OutgoingEmail): Promise<SendResult>;
  /** Optional: many messages in one request (results in the same order). */
  sendBatch?(msgs: OutgoingEmail[]): Promise<SendResult[]>;
}

const defaultFrom = () => process.env.EMAIL_FROM ?? process.env.CONTACT_FROM_EMAIL ?? "Fola Academy <onboarding@resend.dev>";

const toResend = (msg: OutgoingEmail) => ({
  from: msg.from ?? defaultFrom(), to: [msg.to], subject: msg.subject, text: msg.text,
  ...(msg.html ? { html: msg.html } : {}), ...(msg.headers ? { headers: msg.headers } : {}), ...(msg.tags ? { tags: msg.tags } : {}),
  ...(msg.replyTo ? { reply_to: msg.replyTo } : {}), ...(msg.bcc?.length ? { bcc: msg.bcc } : {}),
});

const resend: EmailProvider = {
  name: "resend",
  configured: () => Boolean(process.env.RESEND_API_KEY),
  async send(msg) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { sent: false, reason: "not_configured" };
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(toResend(msg)),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        console.error("[email] provider rejected:", res.status);
        return { sent: false, reason: res.status === 422 || res.status === 400 ? "rejected" : "failed", detail: `HTTP ${res.status}` };
      }
      const body = (await res.json().catch(() => null)) as { id?: string } | null;
      return { sent: true, id: typeof body?.id === "string" ? body.id : null };
    } catch (e) {
      console.error("[email] send failed:", e instanceof Error ? e.message : e);
      return { sent: false, reason: "failed", detail: "network" };
    }
  },
  // Resend batch: up to 100 emails per request (keeps campaigns within the default 2 requests/second limit).
  async sendBatch(msgs) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return msgs.map(() => ({ sent: false, reason: "not_configured" as const }));
    if (msgs.length === 0) return [];
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(msgs.slice(0, 100).map(toResend)),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.error("[email] batch rejected:", res.status);
        return msgs.map(() => ({ sent: false, reason: res.status === 422 || res.status === 400 ? "rejected" as const : "failed" as const, detail: `HTTP ${res.status}` }));
      }
      const body = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
      const ids = Array.isArray(body?.data) ? body!.data : [];
      return msgs.map((_, i) => i < 100
        ? { sent: true as const, id: typeof ids[i]?.id === "string" ? ids[i].id! : null }
        : { sent: false as const, reason: "failed" as const, detail: "over batch size" });
    } catch (e) {
      console.error("[email] batch failed:", e instanceof Error ? e.message : e);
      return msgs.map(() => ({ sent: false, reason: "failed" as const, detail: "network" }));
    }
  },
};

/** "none" turns email off explicitly (nothing is sent, nothing is reported as sent). */
const none: EmailProvider = { name: "none", configured: () => false, send: async () => ({ sent: false, reason: "not_configured" }) };

const PROVIDERS: Record<string, EmailProvider> = { resend, none };

export function getEmailProvider(): EmailProvider {
  return PROVIDERS[(process.env.EMAIL_PROVIDER ?? "resend").toLowerCase()] ?? resend;
}
