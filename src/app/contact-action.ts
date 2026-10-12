"use server";

import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/cms";

export type ContactState = {
  status: "idle" | "sent" | "error" | "fallback";
  errors?: Partial<Record<"name" | "email" | "message", string>>;
  message?: string;
  mailto?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Stores the message in the database (through the submit_contact_message function: the public can insert, never read),
 * and also emails it when Resend is configured. Either one succeeding counts as sent. If both are unavailable the
 * visitor gets a mailto fallback, so a message is never silently lost.
 */
async function store(name: string, email: string, service: string, message: string): Promise<"stored" | "limited" | "failed"> {
  if (!supabaseConfigured) return "failed";
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await sb.rpc("submit_contact_message", { p_name: name, p_email: email, p_service: service, p_message: message });
    if (!error) return "stored";
    if (/too many/i.test(error.message ?? "")) return "limited";
    if (error.code !== "PGRST202") console.error("[contact] store failed:", error.code);
    return "failed";
  } catch {
    return "failed";
  }
}

export async function sendContact(_prev: ContactState, fd: FormData): Promise<ContactState> {
  // Honeypot: bots fill hidden fields.
  if (String(fd.get("company") ?? "")) return { status: "sent" };

  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const service = String(fd.get("service") ?? "").trim().slice(0, 120);
  const message = String(fd.get("message") ?? "").trim();

  const errors: ContactState["errors"] = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (!EMAIL.test(email)) errors.email = "Please enter a valid email address.";
  if (message.length < 10) errors.message = "Tell me a little about what you have in mind (at least a sentence).";
  if (name.length > 120 || email.length > 200 || message.length > 5000) return { status: "error", message: "One of the fields is too long." };
  if (Object.keys(errors).length) return { status: "error", errors };

  const settings = await getSiteSettings();
  const to = settings.contactEmail;
  const subject = `New enquiry from ${name}${service ? ` (${service})` : ""}`;
  const body = `Name: ${name}\nEmail: ${email}\n${service ? `Service: ${service}\n` : ""}\n${message}`;
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const stored = await store(name, email, service, message);
  if (stored === "limited") return { status: "error", message: "You've sent several messages in the last hour. Please wait a little, or email me directly." };

  let emailed = false;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM_EMAIL ?? "Samson Odejinmi <onboarding@resend.dev>",
          to: [process.env.CONTACT_TO_EMAIL ?? to],
          reply_to: email,
          subject,
          text: body,
        }),
      });
      emailed = res.ok;
    } catch {
      emailed = false;
    }
  }

  if (stored === "stored" || emailed) return { status: "sent" };
  return {
    status: "fallback",
    message: key ? "Your message couldn't be sent just now. You can email me directly instead." : "Messages can't be delivered from this form right now, so this didn't go anywhere. You can send it from your own email app instead.",
    mailto,
  };
}
