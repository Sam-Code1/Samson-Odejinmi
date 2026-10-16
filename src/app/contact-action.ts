"use server";

import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/cms";
import { sendEmail } from "@/lib/email";

export type ContactState = {
  status: "idle" | "sent" | "error" | "fallback";
  errors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
  message?: string;
  mailto?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Website contact form:
 *   1. validate on the server
 *   2. save the message (submit_contact_message: the public can insert, never read; 5 per address per hour)
 *   3. email a notification to the configured address with Reply-To set to the visitor, through the email provider
 *   4. record whether that notification was actually sent (sent / failed / not_configured), never assumed
 * Either the save or the email succeeding counts as delivered. If both are unavailable the visitor gets a mailto
 * fallback, so a message is never silently lost.
 */
async function store(name: string, email: string, subject: string, service: string, message: string): Promise<{ state: "stored"; id: string | null } | { state: "limited" | "failed" }> {
  if (!supabaseConfigured) return { state: "failed" };
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    let { data, error } = await sb.rpc("submit_contact_message", { p_name: name, p_email: email, p_subject: subject, p_service: service, p_message: message });
    // Before migration 0009 there is no subject column: fall back to the original 4-argument function.
    if (error?.code === "PGRST202") ({ data, error } = await sb.rpc("submit_contact_message", { p_name: name, p_email: email, p_service: service, p_message: `${subject ? `Subject: ${subject}\n\n` : ""}${message}` }));
    if (!error) return { state: "stored", id: typeof data === "string" ? data : null };
    if (/too many/i.test(error.message ?? "")) return { state: "limited" };
    console.error("[contact] store failed:", error.code);
    return { state: "failed" };
  } catch {
    return { state: "failed" };
  }
}

export async function sendContact(_prev: ContactState, fd: FormData): Promise<ContactState> {
  // Honeypot: bots fill hidden fields.
  if (String(fd.get("company") ?? "")) return { status: "sent" };

  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const subject = String(fd.get("subject") ?? "").trim().replace(/[\r\n]+/g, " ");
  const service = String(fd.get("service") ?? "").trim().slice(0, 120);
  const message = String(fd.get("message") ?? "").trim();

  const errors: ContactState["errors"] = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (!EMAIL.test(email)) errors.email = "Please enter a valid email address.";
  if (subject.length < 2) errors.subject = "Add a short subject.";
  if (message.length < 10) errors.message = "Tell me a little about what you have in mind (at least a sentence).";
  if (name.length > 120 || email.length > 200 || subject.length > 160 || message.length > 5000) return { status: "error", message: "One of the fields is too long." };
  if (Object.keys(errors).length) return { status: "error", errors };

  const settings = await getSiteSettings();
  const to = process.env.CONTACT_TO_EMAIL || settings.contactEmail;
  const mailSubject = `[Website] ${subject} (from ${name})`;
  const body = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n${service ? `Service: ${service}\n` : ""}\n${message}\n\nReply to this email to answer ${name} directly, or reply from Admin → Messages to keep the conversation in one place.`;
  const mailto = `mailto:${settings.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  const stored = await store(name, email, subject, service, message);
  if (stored.state === "limited") return { status: "error", message: "You've sent several messages in the last hour. Please wait a little, or email me directly." };

  const sent = await sendEmail({ to, subject: mailSubject, text: body, replyTo: email, ...(process.env.CONTACT_FROM_EMAIL ? { from: process.env.CONTACT_FROM_EMAIL } : {}) }, "contact");
  // Record the real notification outcome on the stored message (service role; the public can't update messages).
  if (stored.state === "stored" && stored.id) {
    const service = createServiceClient();
    if (service) {
      const { error } = await service.from("contact_messages").update({
        notify_status: sent.sent ? "sent" : sent.reason === "not_configured" ? "not_configured" : "failed", notify_message_id: sent.sent ? sent.id ?? null : null,
      }).eq("id", stored.id);
      if (error && error.code !== "42703" && error.code !== "PGRST204") console.error("[contact] notify status not saved:", error.code);
    }
  }

  if (stored.state === "stored" || sent.sent) return { status: "sent" };
  return {
    status: "fallback",
    message: sent.sent === false && sent.reason !== "not_configured" ? "Your message couldn't be sent just now. You can email me directly instead." : "Messages can't be delivered from this form right now, so this didn't go anywhere. You can send it from your own email app instead.",
    mailto,
  };
}
