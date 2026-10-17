"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setShopperCurrency } from "@/app/currency-actions";
import { cn } from "@/lib/utils";

const LABELS: Record<string, { symbol: string; code: string }> = { NGN: { symbol: "₦", code: "NGN" }, USD: { symbol: "$", code: "USD" }, GBP: { symbol: "£", code: "GBP" } };

/** Switches currency for the whole visit, then re-renders prices from the server. */
export function useSwitchCurrency() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const switchTo = (c: string) => start(async () => { if ((await setShopperCurrency(c)).ok) router.refresh(); });
  return { switchTo, pending };
}

/**
 * The site's one currency control (shop, product pages, course pages, checkout). The default comes from the visitor's
 * country; a manual choice overrides it for the visit. Prices are always re-read from the database for the new currency.
 */
export function CurrencySelector({ current, currencies = ["NGN", "USD", "GBP"], className, size = "md" }: { current: string; currencies?: string[]; className?: string; size?: "sm" | "md" }) {
  const { switchTo, pending } = useSwitchCurrency();
  return (
    <div role="radiogroup" aria-label="Currency" aria-busy={pending} className={cn("inline-flex rounded border border-line-strong p-1", pending && "opacity-70", className)}>
      {currencies.map((c) => {
        const on = c === current;
        return (
          <button key={c} type="button" role="radio" aria-checked={on} disabled={pending} onClick={() => !on && switchTo(c)}
            className={cn("inline-flex items-center gap-1.5 rounded-sm px-3 text-label tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40",
              size === "sm" ? "h-8 min-w-12" : "h-9 min-w-16", on ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink")}>
            <span aria-hidden>{LABELS[c]?.symbol}</span>{LABELS[c]?.code ?? c}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Shown when the selected currency can't be used for this item right now. Offers the currencies that can, as buttons.
 * `reason`: "price" = not priced in it; "payment" = no connected provider can take it.
 */
export function CurrencyUnavailable({ currency, alternatives, reason }: { currency: string; alternatives: string[]; reason: "price" | "payment" }) {
  const { switchTo, pending } = useSwitchCurrency();
  const list = alternatives.filter((c) => c !== currency);
  const names = list.join(" or ");
  return (
    <div role="status" className="rounded border border-line bg-surface/60 p-4 text-body-sm">
      <p className="text-ink">{reason === "payment" ? `${currency} payments are currently unavailable.` : `This isn't on sale in ${currency}.`}</p>
      {list.length > 0 ? (
        <>
          <p className="mt-1 text-ink-2">Please choose {names}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {list.map((c) => (
              <button key={c} type="button" disabled={pending} onClick={() => switchTo(c)}
                className="inline-flex min-h-[44px] items-center rounded border border-line-strong px-4 text-label hover:border-ink disabled:opacity-60">Pay in {c}</button>
            ))}
          </div>
        </>
      ) : <p className="mt-1 text-ink-2">Payments are temporarily unavailable. Please try again later.</p>}
    </div>
  );
}
