import { site } from "@/lib/site";
import { getEmailProvider } from "./providers";

/**
 * Transactional email through the provider abstraction (./providers). Without a configured provider nothing is sent
 * and the result says so: emails are never reported as sent when they weren't.
 *
 * Account emails (verify email, reset password, invitations) are sent by Supabase Auth, not here. In production,
 * point Supabase Auth → SMTP at the same provider so they come from your domain (see ENVIRONMENT.md).
 * Marketing email (campaigns, automations) goes through ./marketing, which adds consent checks and unsubscribe links.
 */
export type EmailMessage = { to: string; subject: string; text: string; html?: string; replyTo?: string; bcc?: string[]; from?: string };
export type EmailResult = { sent: true; id?: string | null } | { sent: false; reason: "not_configured" | "failed" | "rejected" };

export function emailConfigured() {
  return getEmailProvider().configured();
}

export async function sendEmail(msg: EmailMessage, category = "transactional"): Promise<EmailResult> {
  const r = await getEmailProvider().send({ ...msg, tags: [{ name: "category", value: category }] });
  return r.sent ? { sent: true, id: r.id } : { sent: false, reason: r.reason };
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
  /** Paid product (ebook, guide, template, download, bundle). Links to the library, never to the file itself. */
  productPurchase: (o: { name: string; product: string; amount: string; reference: string; courseSlug: string | null }) => ({
    subject: `Your purchase: ${o.product}`,
    text: `Hi ${o.name || "there"},\n\nThank you. Your payment of ${o.amount} was confirmed and ${o.product} is now in your library.\n\n${o.courseSlug ? `Start learning: ${site.url}/learn/${o.courseSlug}\n` : ""}Open your library: ${site.url}/library\nPayment reference: ${o.reference}\n\nDownloads are available after signing in, so your files stay yours.${sign}`,
  }),
  /**
   * An order (shop checkout, guest or account). `orderUrl` is the buyer's private receipt with downloads (a secure,
   * expiring token link). Guests are invited, never required, to create an account; courses need one to start.
   */
  order: (o: { name: string; orderNumber: string; items: string[]; amount: string; orderUrl: string; guest: boolean; hasCourse: boolean; claimUrl: string | null }) => ({
    subject: "Your Fola purchase is ready",
    text: [
      `Hi ${o.name || "there"},`,
      ``,
      `Thank you. Your payment of ${o.amount} is confirmed.`,
      ``,
      `Order ${o.orderNumber}`,
      ...o.items.map((i) => `· ${i}`),
      ``,
      `Download or open your purchase: ${o.orderUrl}`,
      `This private link is for you only and expires in 30 days. You can ask for a new one any time at ${site.url}/order/access`,
      ``,
      `Enjoying it? You can leave a review from the same link: ${o.orderUrl}#review`,
      ...(o.guest && o.claimUrl
        ? [``, o.hasCourse
          ? `Your course needs a free Fola Academy account so your progress and certificate are saved. Create one (or sign in) here and the course is added automatically: ${o.claimUrl}`
          : `Want to keep this purchase in your Fola Library? Create a free account (optional): ${o.claimUrl}`]
        : o.guest ? [] : [``, `It's also in your Library: ${site.url}/library`]),
    ].join("\n") + sign,
  }),
  /** New private links for every paid order on this email (requested at /order/access). */
  orderLinks: (o: { links: { orderNumber: string; url: string }[] }) => ({
    subject: "Your Fola purchase links",
    text: `Hi,\n\nHere are new private links to your purchases. Each expires in 30 days.\n\n${o.links.map((l) => `Order ${l.orderNumber}: ${l.url}`).join("\n")}\n\nIf you didn't ask for these, you can ignore this email: nobody else received them.${sign}`,
  }),
  productAccess: (o: { name: string; product: string; courseSlug: string | null }) => ({
    subject: `You now have: ${o.product}`,
    text: `Hi ${o.name || "there"},\n\n${o.product} is now in your library.\n\n${o.courseSlug ? `Start learning: ${site.url}/learn/${o.courseSlug}\n` : ""}Open your library: ${site.url}/library${sign}`,
  }),
};
