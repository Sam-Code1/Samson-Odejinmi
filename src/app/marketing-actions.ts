"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { EMAIL_RE } from "@/lib/admin/validation";
import { readAttribution } from "@/lib/attribution-server";
import { allowRate, visitorHash } from "@/lib/rate-limit";

/**
 * Public marketing actions: newsletter sign-up (explicit opt-in), unsubscribe, consent settings, affiliate sign-up.
 * Consent is only ever recorded from a box the person ticked themselves; nothing here sends email.
 */
export type FormState = { ok?: boolean; message?: string; error?: string };

export async function subscribeNewsletter(_: FormState, fd: FormData): Promise<FormState> {
  if (String(fd.get("company") ?? "") !== "") return { ok: true, message: "Thanks. You're on the list." }; // honeypot: bots fill hidden fields
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const firstName = String(fd.get("first_name") ?? "").trim().slice(0, 80) || null;
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (fd.get("consent") !== "on") return { error: "Tick the box to confirm you'd like to receive emails." };

  const service = createServiceClient();
  if (!service) return { error: "Sign-up isn't available right now. Please try again later." };
  if (!(await allowRate("newsletter", await visitorHash(), 5, 60))) return { error: "Too many sign-ups from here. Please try again in an hour." };

  const { ref, attribution } = await readAttribution();
  const { data: aff } = ref ? await service.from("affiliates").select("id").eq("code", ref).eq("status", "active").maybeSingle() : { data: null };
  const now = new Date().toISOString();
  const { data: existing } = await service.from("contacts").select("id, first_name").eq("email", email).maybeSingle();
  const consent = { marketing_consent: true, consent_at: now, consent_source: "newsletter_form", unsubscribed_at: null };
  const { error } = existing
    ? await service.from("contacts").update({ ...consent, first_name: existing.first_name ?? firstName, ...(attribution.last ? { last_touch: attribution.last } : {}) }).eq("id", existing.id)
    : await service.from("contacts").insert({ email, first_name: firstName, source: "newsletter", ...consent, first_touch: attribution.first ?? {}, last_touch: attribution.last ?? {}, referred_by_affiliate: aff?.id ?? null });
  if (error) { console.error("[newsletter] save failed:", error.code); return { error: "That didn't work. Please try again." }; }
  // Same message whether or not the address was already known (no account enumeration).
  return { ok: true, message: "Thanks. You're on the list. You can unsubscribe from any email with one click." };
}

export async function confirmUnsubscribe(_: FormState, fd: FormData): Promise<FormState> {
  const t = String(fd.get("t") ?? ""), m = String(fd.get("m") ?? "");
  if (!/^[a-f0-9]{64}$/.test(t)) return { error: "This unsubscribe link is incomplete. Copy the full link from the email, or reply to it and we'll remove you." };
  const service = createServiceClient();
  if (!service) return { error: "This isn't available right now. Please reply to the email and we'll remove you." };
  const { data, error } = await service.rpc("unsubscribe_by_token", { p_token: t, p_message: /^[0-9a-f-]{36}$/i.test(m) ? m : null });
  if (error || !(data as { ok?: boolean } | null)?.ok) return { error: "We couldn't find that subscription. It may already be removed." };
  return { ok: true, message: "You're unsubscribed. You won't receive marketing emails from us any more. Emails about your purchases and account still arrive." };
}

export async function setMarketingConsent(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in." };
  const on = fd.get("marketing") === "on";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_marketing_consent", { p_on: on });
  if (error) return { error: error.code === "PGRST202" ? "Email preferences aren't available yet." : "That didn't save. Please try again." };
  revalidatePath("/settings");
  return { ok: true, message: on ? "You'll receive occasional emails about new courses and products." : "You won't receive marketing emails." };
}

const AFF_ERRORS: Record<string, string> = {
  sign_in: "Please sign in.", exists: "You've already applied.", bad_code: "Use 3–24 letters, numbers, - or _ (starting with a letter or number).", code_taken: "That code is taken. Try another.",
};

export async function applyAffiliate(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in." };
  if (fd.get("terms") !== "on") return { error: "Please confirm you've read how the programme works." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_affiliate", { p_code: String(fd.get("code") ?? "").slice(0, 24), p_payout: String(fd.get("payout") ?? "").slice(0, 500) });
  const r = data as { ok: boolean; error?: string } | null;
  if (error || !r) return { error: "That didn't work. Please try again." };
  if (!r.ok) return { error: AFF_ERRORS[r.error ?? ""] ?? "That didn't work." };
  revalidatePath("/affiliate");
  return { ok: true, message: "Thanks. Your application is in. You'll be able to share your link as soon as it's approved." };
}

export async function updateAffiliatePayout(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_affiliate_payout", { p_payout: String(fd.get("payout") ?? "").slice(0, 500) });
  if (error) return { error: "That didn't save. Please try again." };
  revalidatePath("/affiliate");
  return { ok: true, message: "Payout details saved." };
}
