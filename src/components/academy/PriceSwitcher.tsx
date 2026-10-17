import type { PriceRow } from "@/content/course";
import { formatMoney, cn } from "@/lib/utils";
import { CurrencySelector } from "./CurrencySelector";

/**
 * The price in the shopper's selected currency (server-rendered; prices come from the database) with the site's one
 * currency selector. It holds no currency state of its own: the checkout panel on the same page reads the same value,
 * so the price shown is always the price charged.
 */
export function PriceSwitcher({ prices, currency, size = "lg" }: { prices: PriceRow[]; currency: string; size?: "md" | "lg" }) {
  if (prices.length === 0) return <p className="text-body-sm text-ink-3">Pricing will be announced when enrolment opens.</p>;
  const current = prices.find((p) => p.currency === currency);
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {current ? (
          <p className={cn("font-medium tracking-tight tabular-nums", size === "lg" ? "text-h1" : "text-h3")}>{current.amountMinor === 0 ? "Free" : formatMoney(current.amountMinor, current.currency)}</p>
        ) : (
          <p className={cn("tracking-tight text-ink-2", size === "lg" ? "text-h3" : "text-h4")}>Not available in {currency}</p>
        )}
        {current && current.amountMinor > 0 && <p className="text-body-sm text-ink-3">one-time</p>}
      </div>
      {prices.length > 1 || !current ? <CurrencySelector current={currency} className="mt-5" /> : null}
    </div>
  );
}
