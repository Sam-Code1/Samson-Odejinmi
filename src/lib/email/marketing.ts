import { site } from "@/lib/site";
import { getEmailProvider, type SendResult } from "./providers";

/**
 * Marketing email (campaigns, automations). Callers must only pass contacts who have consented and haven't
 * unsubscribed: the queue (start_email_campaign) and the automation engine both enforce that before calling this.
 * Every message carries an unsubscribe link in the footer and RFC 8058 one-click List-Unsubscribe headers.
 *
 * Body format (plain text, never raw HTML): blank line = new paragraph, **bold**, [label](https://link),
 * lines starting with "- " = bullet list, {{first_name}} = recipient's first name (or "there").
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function personalise(text: string, firstName: string | null | undefined) {
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, (firstName ?? "").trim() || "there");
}

function inline(s: string) {
  // Escape first, then add the two allowed inline forms. Links must be https.
  return esc(s)
    .replace(/\*\*([^*]{1,200})\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]{1,120})\]\((https:\/\/[^\s)]{1,500})\)/g, (_, label: string, url: string) => `<a href="${url}" style="color:#2662e0">${label}</a>`);
}

export function renderBodyHtml(body: string): string {
  return body.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      return `<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:0 0 6px">${inline(l.replace(/^\s*-\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 16px">${lines.map(inline).join("<br>")}</p>`;
  }).join("");
}

export function renderBodyText(body: string): string {
  return body.trim().replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, "$1 ($2)");
}

export function unsubscribeUrls(token: string, messageId: string | null) {
  const q = `t=${encodeURIComponent(token)}${messageId ? `&m=${encodeURIComponent(messageId)}` : ""}`;
  return { page: `${site.url}/unsubscribe?${q}`, oneClick: `${site.url}/api/unsubscribe?${q}` };
}

export function buildMarketingEmail(o: { firstName: string | null; subject: string; previewText?: string | null; body: string; unsubscribeToken: string; messageId: string | null }) {
  const body = personalise(o.body, o.firstName);
  const urls = unsubscribeUrls(o.unsubscribeToken, o.messageId);
  const address = process.env.MARKETING_POSTAL_ADDRESS?.trim();
  const footerText = `\n\n—\nYou're receiving this because you subscribed to updates from Fola Academy.\nUnsubscribe: ${urls.page}${address ? `\n${address}` : ""}`;
  const preheader = o.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.previewText)}</div>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f9f8fd">${preheader}
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#0e102a">
${renderBodyHtml(body)}
<hr style="border:0;border-top:1px solid #e3e3ee;margin:32px 0 16px">
<p style="margin:0;font-size:13px;color:#565e7d">You're receiving this because you subscribed to updates from Fola Academy.
<a href="${esc(urls.page)}" style="color:#565e7d">Unsubscribe</a>${address ? `<br>${esc(address)}` : ""}</p>
</div></body></html>`;
  return {
    subject: personalise(o.subject, o.firstName),
    text: renderBodyText(body) + footerText,
    html,
    headers: { "List-Unsubscribe": `<${urls.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export async function sendMarketingEmail(o: { to: string; fromName?: string | null; email: ReturnType<typeof buildMarketingEmail>; category: "campaign" | "automation" | "test" }): Promise<SendResult> {
  const fromAddr = process.env.MARKETING_EMAIL_FROM ?? process.env.EMAIL_FROM;
  const from = fromAddr && o.fromName ? `${o.fromName.replace(/[<>"\r\n]/g, "")} <${fromAddr.replace(/^.*<([^>]+)>.*$/, "$1")}>` : fromAddr;
  return getEmailProvider().send({ to: o.to, from, subject: o.email.subject, text: o.email.text, html: o.email.html, headers: o.email.headers, tags: [{ name: "category", value: o.category }] });
}

export function marketingEmailConfigured() {
  return getEmailProvider().configured();
}
