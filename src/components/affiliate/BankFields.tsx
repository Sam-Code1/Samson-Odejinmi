"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, TriangleAlert } from "lucide-react";
import { lookupBankAccount } from "@/app/marketing-actions";
import type { Bank } from "@/lib/banks";

type Status = "idle" | "checking" | "ok" | "invalid" | "unavailable";

const control =
  "h-12 w-full rounded border border-line-strong bg-canvas px-4 text-body text-ink placeholder:text-ink-3 transition-colors hover:border-ink/50 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30";

/**
 * Bank details for payouts: pick the bank, type the account number, and the account name appears straight from the
 * bank so it's clear the account is real. If the list or the check isn't available, the person can type the details
 * (those are marked unverified and our team checks them before paying). The server re-checks everything on submit.
 */
export function BankFields({ banks }: { banks: Bank[] }) {
  const [code, setCode] = useState("");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const run = useRef(0);

  const manual = code === "other" || banks.length === 0;
  const digits = number.replace(/\D/g, "").slice(0, 10);

  useEffect(() => {
    if (manual || !code || digits.length !== 10) { setStatus("idle"); setName(""); setMsg(""); return; }
    const mine = ++run.current;
    setStatus("checking"); setName(""); setMsg("");
    lookupBankAccount(code, digits)
      .then((r) => {
        if (mine !== run.current) return;
        if (r.ok && r.name) { setStatus("ok"); setName(r.name); }
        else { setStatus(r.unavailable ? "unavailable" : "invalid"); setMsg(r.error ?? ""); }
      })
      .catch(() => { if (mine === run.current) { setStatus("unavailable"); setMsg("We can't check this automatically right now. Enter the account name yourself."); } });
  }, [code, digits, manual]);

  const needsName = manual || status === "unavailable";

  return (
    <fieldset className="space-y-5">
      <legend className="mb-1 text-label text-ink">Where should we pay you?</legend>
      <p className="-mt-1 text-caption text-ink-3">Nigerian bank account. Only you and our finance team can see this, and we use it only to pay your commission.</p>

      {banks.length > 0 && (
        <div>
          <label htmlFor="bank_code" className="mb-2 block text-label text-ink">Bank</label>
          <div className="relative">
            <select id="bank_code" name="bank_code" value={code} onChange={(e) => setCode(e.target.value)} required className={`${control} appearance-none pr-10`}>
              <option value="" disabled>Choose your bank</option>
              {banks.map((b) => <option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}
              <option value="other">My bank isn&apos;t listed</option>
            </select>
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 8 5 5 5-5" /></svg>
          </div>
        </div>
      )}
      {banks.length === 0 && <input type="hidden" name="bank_code" value="other" />}

      {manual && (
        <div>
          <label htmlFor="bank_name" className="mb-2 block text-label text-ink">Bank name</label>
          <input id="bank_name" name="bank_name" required maxLength={120} autoComplete="off" placeholder="e.g. Kuda Microfinance Bank" className={control} />
        </div>
      )}

      <div>
        <label htmlFor="account_number" className="mb-2 block text-label text-ink">Account number</label>
        <input id="account_number" name="account_number" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" maxLength={10} required placeholder="10 digits"
          value={digits} onChange={(e) => setNumber(e.target.value)} aria-describedby="account-status" className={`${control} tabular-nums tracking-wider`} />
        <div id="account-status" aria-live="polite" className="mt-2 min-h-[1.5rem] text-body-sm">
          {status === "checking" && <p className="flex items-center gap-2 text-ink-3"><Loader2 aria-hidden className="h-4 w-4 animate-spin" />Checking with your bank…</p>}
          {status === "ok" && <p className="flex items-start gap-2 font-medium text-ink"><BadgeCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--success))]" /><span><span className="block text-caption font-normal text-ink-3">Account name</span>{name}</span></p>}
          {status === "invalid" && <p className="flex items-start gap-2 text-[rgb(var(--warm))]"><TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>}
          {status === "unavailable" && <p className="flex items-start gap-2 text-ink-2"><TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />{msg}</p>}
        </div>
      </div>

      {needsName && (
        <div>
          <label htmlFor="account_name" className="mb-2 block text-label text-ink">Account name</label>
          <input id="account_name" name="account_name" required maxLength={160} autoComplete="off" placeholder="As it appears on your account" className={control} />
          <p className="mt-2 text-caption text-ink-3">We couldn&apos;t verify this account automatically, so our team will check it before the first payout.</p>
        </div>
      )}
    </fieldset>
  );
}
