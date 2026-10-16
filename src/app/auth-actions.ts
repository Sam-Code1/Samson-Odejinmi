"use server";

import { readAttribution } from "@/lib/attribution-server";
import { createServiceClient } from "@/lib/supabase/admin";
import { recordSecurityEvent } from "@/lib/security";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

export type FormState = { error?: string; message?: string; fields?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_CONFIGURED = "Accounts aren't available right now. Please try again later.";

async function origin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED };
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL.test(email) || !password) return { error: "Enter your email and password.", fields: { email } };

  const supabase = await createClient();
  const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
  await recordSecurityEvent(error ? "login_failed" : "login_success", { email, userId: signed?.user?.id ?? null });
  // One generic message for every failure, so the form doesn't reveal which accounts exist.
  if (error) return { error: "That email and password don't match. Check them and try again.", fields: { email } };
  redirect(safeNext(fd.get("next")));
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED };
  const first = String(fd.get("first_name") ?? "").trim();
  const last = String(fd.get("last_name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const fields = { first_name: first, last_name: last, email };

  if (!first || !last) return { error: "Enter your first and last name.", fields };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address.", fields };
  if (password.length < 8) return { error: "Use a password with at least 8 characters.", fields };
  if (password !== confirm) return { error: "The two passwords don't match.", fields };

  const supabase = await createClient();
  const base = await origin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // marketing_consent only when the person ticked the (unticked by default) box; read by handle_new_user (migration 0008).
    options: { data: { first_name: first, last_name: last, ...(fd.get("marketing_consent") === "on" ? { marketing_consent: "true" } : {}) }, emailRedirectTo: `${base}/auth/callback?next=/dashboard` },
  });
  if (error) return { error: "We couldn't create your account. Check your details and try again.", fields };
  if (data.user) { await recordSignupAttribution(data.user.id); await recordSecurityEvent("signup", { email, userId: data.user.id }); }
  // If email confirmation is off, a session exists already.
  if (data.session) redirect("/dashboard");
  return { message: "Check your email for a link to confirm your account." };
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED };
  const email = String(fd.get("email") ?? "").trim();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address.", fields: { email } };
  const supabase = await createClient();
  const base = await origin();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${base}/auth/callback?next=/reset-password` });
  await recordSecurityEvent("password_reset_requested", { email });
  // Same response whether or not the account exists.
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  if (!supabaseConfigured) return { error: NOT_CONFIGURED };
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use a password with at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We couldn't update your password. Try a different one." };
  await recordSecurityEvent("password_changed", { userId: data.user.id, email: data.user.email, detail: "reset link" });
  redirect("/dashboard");
}

export async function signOut() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

/**
 * Where a new account came from (UTM / referral cookies set by the middleware), saved on their CRM contact.
 * Best effort and server-only: it never blocks sign-up, and only fills fields that are still empty.
 */
async function recordSignupAttribution(userId: string) {
  try {
    const { ref, attribution } = await readAttribution();
    if (!ref && !attribution.first && !attribution.last) return;
    const service = createServiceClient();
    if (!service) return;
    const { data: c } = await service.from("contacts").select("id, first_touch, referred_by_affiliate").eq("user_id", userId).maybeSingle();
    if (!c) return;
    const { data: aff } = ref ? await service.from("affiliates").select("id, user_id").eq("code", ref).eq("status", "active").maybeSingle() : { data: null };
    const empty = !c.first_touch || Object.keys(c.first_touch as object).length === 0;
    await service.from("contacts").update({
      ...(empty && attribution.first ? { first_touch: attribution.first } : {}),
      ...(attribution.last ? { last_touch: attribution.last } : {}),
      ...(!c.referred_by_affiliate && aff && aff.user_id !== userId ? { referred_by_affiliate: aff.id } : {}),
    }).eq("id", c.id);
  } catch {
    /* best effort */
  }
}
