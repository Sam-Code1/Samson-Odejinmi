"use client";

import { Building2, CreditCard, Landmark, QrCode, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type MethodChoice = { method: string; label: string };

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  card: CreditCard, bank: Landmark, bank_transfer: Building2, ussd: Smartphone, qr: QrCode, mobile_money: Smartphone, opay: Wallet, apple_pay: Smartphone,
};

/** Payment methods the server says are available for this currency and buyer. The server re-checks the choice. */
export function MethodPicker({ methods, value, onChange }: { methods: MethodChoice[]; value: string; onChange: (m: string) => void }) {
  if (methods.length <= 1) return methods[0] ? <input type="hidden" name="method" value={methods[0].method} /> : null;
  return (
    <fieldset>
      <legend className="mb-2 text-caption text-ink-3">Pay with</legend>
      <input type="hidden" name="method" value={value} />
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
        {methods.map((m) => {
          const Icon = ICON[m.method] ?? CreditCard;
          const on = m.method === value;
          return (
            <button key={m.method} type="button" role="radio" aria-checked={on} onClick={() => onChange(m.method)}
              className={cn("flex min-h-[44px] items-center gap-2 rounded border px-3 text-left text-label transition-colors", on ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:text-ink")}>
              <Icon aria-hidden className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{m.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
