"use client";

import { useState } from "react";
import type { Currency, PriceRow } from "@/content/course";
import { formatMoney, cn } from "@/lib/utils";

/** Shows the price in the visitor's likely currency with a manual override. Prices come from the server (course_pricing). */
export function PriceSwitcher({ prices, defaultCurrency, size = "lg" }: { prices: PriceRow[]; defaultCurrency: Currency; size?: "md" | "lg" }) {
  const available = prices.map((p) => p.currency);
  const [currency, setCurrency] = useState<Currency>(available.includes(defaultCurrency) ? defaultCurrency : available[0]);
  if (prices.length === 0) return <p className="text-body-sm text-ink-3">Pricing will be announced when enrolment opens.</p>;
  const current = prices.find((p) => p.currency === currency);
  if (!current) return null;

  return (
    <div>
      <div className="flex items-baseline gap-4">
        <p className={cn("font-medium tracking-tight tabular-nums", size === "lg" ? "text-h1" : "text-h3")} aria-live="polite">
          {formatMoney(current.amountMinor, current.currency)}
        </p>
        <p className="text-body-sm text-ink-3">one-time</p>
      </div>
      {prices.length > 1 && (
        <div role="radiogroup" aria-label="Currency" className="mt-5 inline-flex rounded border border-line-strong p-1">
          {prices.map((p) => {
            const active = p.currency === currency;
            return (
              <button key={p.currency} type="button" role="radio" aria-checked={active} onClick={() => setCurrency(p.currency)}
                className={cn("h-9 min-w-16 rounded-sm px-3 text-label transition-colors", active ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink")}>
                {p.currency === "NGN" ? "₦ Naira" : p.currency === "GBP" ? "£ GBP" : "$ USD"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
