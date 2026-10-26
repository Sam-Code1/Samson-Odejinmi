"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { EMAIL_RE } from "@/lib/admin/validation";
import { readAttribution } from "@/lib/attribution-server";
import { allowRate, visitorHash } from "@/lib/rate-limit";
import { createHash } from "node:crypto";
import { getBanks, resolveAccount } from "@/lib/banks";

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

type BankInput = { bank_name: string; bank_code: string | null; account_number: string; account_name: string; verified: boolean };

/** Checks the bank details from the form on the server (never trusting the browser): real bank, 10-digit number, and the account name from the bank itself. */
async function checkBank(userId: string, fd: FormData): Promise<{ ok: true; bank: BankInput } | { ok: false; error: string }> {
  const choice = String(fd.get("bank_code") ?? "");
  const number = String(fd.get("account_number") ?? "").replace(/\s+/g, "");
  const typedName = String(fd.get("account_name") ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 160);
  if (!/^[0-9]{10}$/.test(number)) return { ok: false, error: "Enter your 10-digit account number." };
  if (choice === "other" || choice === "") {
    const bankName = String(fd.get("bank_name") ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 120);
    if (choice === "") return { ok: false, error: "Choose your bank." };
    if (bankName.length < 2) return { ok: false, error: "Type the name of your bank." };
    if (typedName.length < 3) return { ok: false, error: "Enter the account name exactly as it appears on your account." };
    return { ok: true, bank: { bank_name: bankName, bank_code: null, account_number: number, account_name: typedName, verified: false } };
  }
  const banks = await getBanks();
  const bank = banks.find((b) => b.code === choice);
  if (!bank) return { ok: false, error: "Choose your bank from the list." };
  const key = createHash("sha256").update(`bank_check:${userId}`).digest("hex");
  if (!(await allowRate("bank_check", key, 20, 60))) return { ok: false, error: "Too many account checks. Please try again in a few minutes." };
  const r = await resolveAccount(bank.code, number);
  if (r.ok) return { ok: true, bank: { bank_name: bank.name, bank_code: bank.code, account_number: number, account_name: r.name, verified: true } };
  if (r.reason === "invalid") return { ok: false, error: `${bank.name} doesn't recognise that account number. Check the number and the bank.` };
  if (typedName.length < 3) return { ok: false, error: "We couldn't check the account automatically just now. Enter the account name exactly as it appears on your account and try again." };
  return { ok: true, bank: { bank_name: bank.name, bank_code: bank.code, account_number: number, account_name: typedName, verified: false } };
}

const bankText = (b: BankInput) => [b.bank_name, b.account_number, b.account_name].join(String.fromCharCode(10));

/** Live check while the person types: the account name from the bank, so they can see it's really theirs. */
export async function lookupBankAccount(bankCode: string, accountNumber: string): Promise<{ ok: boolean; name?: string; error?: string; unavailable?: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const number = String(accountNumber ?? "").replace(/\s+/g, "");
  if (!/^[0-9]{10}$/.test(number) || !/^[0-9A-Za-z]{2,12}$/.test(String(bankCode ?? ""))) return { ok: false, error: "Enter your 10-digit account number." };
  const key = createHash("sha256").update(`bank_check:${user.id}`).digest("hex");
  if (!(await allowRate("bank_check", key, 20, 60))) return { ok: false, error: "Too many checks. Please wait a few minutes." };
  const r = await resolveAccount(bankCode, number);
  if (r.ok) return { ok: true, name: r.name };
  return r.reason === "invalid" ? { ok: false, error: "We couldn't find that account at this bank. Check the number and the bank." } : { ok: false, unavailable: true, error: "We can't check this automatically right now. Enter the account name yourself." };
}

export async function applyAffiliate(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in." };
  if (fd.get("terms") !== "on") return { error: "Please confirm you've read how the programme works." };
  const plan = String(fd.get("plan") ?? "").trim().slice(0, 1000);
  if (plan.length < 10) return { error: "Tell us briefly how you plan to share Fola Academy (a few words is enough)." };
  const bank = await checkBank(user.id, fd);
  if (!bank.ok) return { error: bank.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_affiliate", { p_code: String(fd.get("code") ?? "").slice(0, 24), p_payout: bankText(bank.bank), p_plan: plan });
  const r = data as { ok: boolean; error?: string } | null;
  if (error?.code === "PGRST202") return { error: "Applications aren't open yet. Please try again soon." };
  if (error || !r) return { error: "That didn't work. Please try again." };
  if (!r.ok) return { error: AFF_ERRORS[r.error ?? ""] ?? "That didn't work." };
  await saveBank(user.id, bank.bank);
  revalidatePath("/affiliate", "layout");
  return { ok: true, message: "Thanks. Your application is in. You'll be able to share your link as soon as it's approved." };
}

/** Saves the checked details with the server-only function. Best effort at application time (the text copy is already saved). */
async function saveBank(userId: string, b: BankInput): Promise<boolean> {
  const service = createServiceClient();
  if (!service) return false;
  const { data, error } = await service.rpc("set_affiliate_payout", { p_user: userId, p_bank_name: b.bank_name, p_bank_code: b.bank_code, p_account_number: b.account_number, p_account_name: b.account_name, p_verified: b.verified });
  return !error && data === true;
}

export async function updateAffiliatePayout(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in." };
  const bank = await checkBank(user.id, fd);
  if (!bank.ok) return { error: bank.error };
  if (!(await saveBank(user.id, bank.bank))) return { error: "That didn't save. Please try again." };
  revalidatePath("/affiliate", "layout");
  return { ok: true, message: bank.bank.verified ? `Saved and verified: ${bank.bank.account_name}.` : "Saved. We couldn't verify this account automatically, so our team will check it before paying." };
}
