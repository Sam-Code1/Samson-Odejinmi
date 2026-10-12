import { site } from "@/lib/site";

/**
 * Transactional email. Provider abstraction with one implementation (Resend, already used by the contact form).
 * Without RESEND_API_KEY nothing is sent and the result says so: emails are never reported as sent when they weren't.
 *
 * Account emails (verify email, reset password, invitations) are sent by Supabase Auth, not here. In production,
 * point Supabase Auth → SMTP at the same provider so they come from your domain (see ENVIRONMENT.md).
 */
export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type EmailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? process.env.CONTACT_FROM_EMAIL ?? "Fola Academy <onboarding@resend.dev>", to: [msg.to], subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}) }),
    });
    if (!res.ok) { console.error("[email] provider rejected:", res.status); return { sent: false, reason: "failed" }; }
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "failed" };
  }
}

// ───────────── templates (plain text: readable everywhere, nothing to escape) ─────────────
const sign = `\n\nFola Academy\n${site.url}/academy`;

export const templates = {
  welcome: (name: string) => ({
    subject: "Welcome to Fola Academy",
    text: `Hi ${name || "there"},\n\nYour Fola Academy account is ready. When you enrol in a course it will appear on your dashboard:\n${site.url}/dashboard${sign}`,
  }),
  purchase: (o: { name: string; course: string; amount: string; reference: string; slug: string }) => ({
    subject: `You're enrolled: ${o.course}`,
    text: `Hi ${o.name || "there"},\n\nThank you. Your payment of ${o.amount} was confirmed and you now have access to ${o.course}.\n\nStart learning: ${site.url}/learn/${o.slug}\nPayment reference: ${o.reference}${sign}`,
  }),
  enrolment: (o: { name: string; course: string; slug: string }) => ({
    subject: `You're enrolled: ${o.course}`,
    text: `Hi ${o.name || "there"},\n\nYou now have access to ${o.course}.\n\nStart learning: ${site.url}/learn/${o.slug}${sign}`,
  }),
  certificate: (o: { name: string; course: string; number: string }) => ({
    subject: `Your certificate for ${o.course}`,
    text: `Congratulations ${o.name || ""},\n\nYou've completed ${o.course}. Your certificate number is ${o.number}.\n\nAnyone can verify it here: ${site.url}/verify/certificate/${o.number}${sign}`,
  }),
};
