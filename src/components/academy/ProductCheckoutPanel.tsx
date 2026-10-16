"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { quoteProduct, startProductCheckout, type ProductCheckoutState, type ProductQuote } from "@/app/product-checkout-actions";
import { Button } from "@/components/ui/Button";
import { MethodPicker, type MethodChoice } from "./MethodPicker";
import { cn, formatMoney } from "@/lib/utils";

type Price = { currency: string; amountMinor: number };

/**
 * Buy panel for a product. Shows only the server's own quote (base, discount, total); the browser sends the product,
 * currency and coupon code, never a price. Access is granted after Paystack verification or a server-side free checkout.
 */
export function ProductCheckoutPanel({ productId, slug, prices, methods, signedIn, owned, ownedHref }: {
  productId: string; slug: string; prices: Price[]; methods: Record<string, MethodChoice[]>; signedIn: boolean; owned: boolean; ownedHref: string;
}) {
  const options = prices.filter((p) => p.amountMinor === 0 || (methods[p.currency]?.length ?? 0) > 0);
  const [currency, setCurrency] = useState(options[0]?.currency ?? "");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState("");
  const [quote, setQuote] = useState<ProductQuote | null>(null);
  const [checking, startCheck] = useTransition();
  const [state, action, pending] = useActionState<ProductCheckoutState, FormData>(startProductCheckout, {});
  const next = `/academy/shop/${slug}`;

  if (owned) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-ink-2">You already have this.</p>
        <Button href={ownedHref} className="w-full">{ownedHref.startsWith("/learn") ? "Go to the course" : "Open your library"}</Button>
      </div>
    );
  }
  if (!options.length) return <p className="text-body-sm text-ink-2">This isn&apos;t on sale right now.</p>;
  if (!signedIn) {
    return (
      <div className="space-y-3">
        <Button href={`/register?next=${encodeURIComponent(next)}`} className="w-full">Create an account to buy</Button>
        <p className="text-caption text-ink-3">Already have one? <a href={`/login?next=${encodeURIComponent(next)}`} className="underline underline-offset-4">Log in</a>. Your purchase is kept in your library.</p>
      </div>
    );
  }

  const base = options.find((o) => o.currency === currency)?.amountMinor ?? 0;
  const applied = quote?.ok && quote.currency === currency ? quote : null;
  const total = applied ? applied.total : base;
  const apply = () => startCheck(async () => setQuote(await quoteProduct(productId, currency, code)));

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      {options.length > 1 && (
        <div role="radiogroup" aria-label="Currency" className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o.currency} type="button" role="radio" aria-checked={o.currency === currency} onClick={() => { setCurrency(o.currency); setQuote(null); setMethod(""); }}
              className={cn("min-h-[44px] rounded border px-4 text-label", o.currency === currency ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:text-ink")}>{o.currency}</button>
          ))}
        </div>
      )}
      {base > 0 && (
        <div>
          <label htmlFor="coupon" className="mb-1.5 block text-caption text-ink-3">Coupon code (optional)</label>
          <div className="flex gap-2">
            <input id="coupon" name="coupon" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); }} maxLength={32} autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded border border-line-strong bg-transparent px-3 text-base uppercase tracking-wide focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm" />
            <button type="button" onClick={apply} disabled={!code || checking} className="h-11 rounded border border-line-strong px-4 text-label hover:border-ink disabled:opacity-50">{checking ? "Checking…" : "Apply"}</button>
          </div>
          {quote && !quote.ok && <p role="alert" className="mt-2 text-caption text-warm">{quote.error}</p>}
          {applied && applied.discount > 0 && <p role="status" className="mt-2 text-caption text-blue">{applied.couponCode} applied: {formatMoney(applied.discount, currency)} off.</p>}
        </div>
      )}
      {total > 0 && <MethodPicker methods={methods[currency] ?? []} value={method || methods[currency]?.[0]?.method || ""} onChange={setMethod} />}
      <dl className="space-y-1 border-t border-line pt-4 text-body-sm">
        {applied && applied.discount > 0 && <div className="flex justify-between text-ink-3"><dt>Price</dt><dd className="tabular-nums line-through">{formatMoney(applied.base, currency)}</dd></div>}
        <div className="flex justify-between text-h4"><dt>Total</dt><dd className="tabular-nums">{total === 0 ? "Free" : formatMoney(total, currency)}</dd></div>
      </dl>
      {state.error && <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Starting…" : total === 0 ? "Get it free" : `Pay ${formatMoney(total, currency)}`}</Button>
      {total > 0 && <p className="text-caption text-ink-3">Secure payment through our payment provider. It appears in your library as soon as your payment is confirmed.</p>}
    </form>
  );
}
