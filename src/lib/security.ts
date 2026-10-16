import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Security event log (Admin → Security). Server-only, service role. Never stores raw emails, IPs or passwords:
 * emails and IPs are salted SHA-256 hashes (so repeated failures can be grouped) plus a masked hint for humans.
 * Logging is best effort and never blocks sign-in.
 */
export type SecurityKind = "login_success" | "login_failed" | "signup" | "password_reset_requested" | "password_changed" | "admin_stepup_success" | "admin_stepup_failed" | "rate_limited";

const salt = () => process.env.SECURITY_LOG_SALT ?? process.env.AI_RATE_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fola";
const hash = (v: string) => createHash("sha256").update(`${salt()}:${v}`).digest("hex");

/** "samson@gmail.com" → "sa•••@gmail.com". */
export function maskEmail(email: string): string {
  const [user, domain] = email.toLowerCase().split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}•••@${domain.slice(0, 60)}`;
}

export async function recordSecurityEvent(kind: SecurityKind, o: { userId?: string | null; email?: string | null; detail?: string } = {}) {
  const service = createServiceClient();
  if (!service) return;
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
    const email = o.email?.trim().toLowerCase() || null;
    await service.from("security_events").insert({
      kind, user_id: o.userId ?? null, email_hash: email ? hash(email) : null, email_hint: email ? maskEmail(email) : null,
      ip_hash: ip ? hash(ip) : null, detail: o.detail?.slice(0, 200) ?? null,
    });
  } catch { /* best effort */ }
}
