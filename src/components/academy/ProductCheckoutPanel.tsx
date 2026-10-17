"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quoteProduct, startProductCheckout, type ProductCheckoutState, type ProductQuote } from "@/app/product-checkout-actions";
import { Button } from "@/components/ui/Button";
import { PaymentPicker } from "./PaymentPicker";
import { CurrencyUnavailable } from "./CurrencySelector";
import type { PublicPayment } from "@/lib/payments/options";
import { formatMoney } from "@/lib/utils";

type Price = { currency: string; amountMinor: number };

/**
 * Buy panel for a product, in the shopper's ONE selected currency (chosen with the site's CurrencySelector, read on
 * the server). Shows only the server's own quote (base, discount, total); the browser sends the product, currency,
 * coupon code and preferred provider, never a price. Access is granted after provider verification or a server-side
 * free checkout.
 */
export function ProductCheckoutPanel({ productId, slug, prices, currency, payment, signedIn, owned, ownedHref }: {
  productId: string; slug: string; prices: Price[]; currency: string; payment: PublicPayment; signedIn: boolean; owned: boolean; ownedHref: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [provider, setProvider] = useState("");
  const [quote, setQuote] = useState<ProductQuote | null>(null);
  const [checking, startCheck] = useTransition();
  const [state, action, pending] = useActionState<ProductCheckoutState, FormData>(startProductCheckout, {});
  const next = `/academy/shop/${slug}`;
  // A provider just refused this currency: re-render so it disappears from the options.
  useEffect(() => { if (state.code === "currency_unavailable") router.refresh(); }, [state, router]);

  if (owned) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-ink-2">You already have this.</p>
        <Button href={ownedHref} className="w-full">{ownedHref.startsWith("/learn") ? "Go to the course" : "Open your library"}</Button>
      </div>
    );
  }
  const payable = (c: string) => prices.some((p) => p.currency === c && (p.amountMinor === 0 || (payment.providers[c]?.length ?? 0) > 0));
  const offered = prices.filter((p) => payable(p.currency)).map((p) => p.currency);
  if (!offered.length) return <p className="text-body-sm text-ink-2">This isn&apos;t on sale right now.</p>;

  const price = prices.find((p) => p.currency === currency);
  if (!price) return <CurrencyUnavailable currency={currency} alternatives={offered} reason="price" />;
  if (!payable(currency)) return <CurrencyUnavailable currency={currency} alternatives={offered} reason="payment" />;

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <Button href={`/register?next=${encodeURIComponent(next)}`} className="w-full">Create an account to buy</Button>
        <p className="text-caption text-ink-3">Already have one? <a href={`/login?next=${encodeURIComponent(next)}`} className="underline underline-offset-4">Log in</a>. Your purchase is kept in your library.</p>
      </div>
    );
  }

  const providers = payment.providers[currency] ?? [];
  const chosen = providers.some((p) => p.id === provider) ? provider : providers[0]?.id ?? "";
  const applied = quote?.ok && quote.currency === currency ? quote : null;
  const total = applied ? applied.total : price.amountMinor;
  const apply = () => startCheck(async () => setQuote(await quoteProduct(productId, currency, code)));

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      {price.amountMinor > 0 && (
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
      {total > 0 && <PaymentPicker providers={providers} value={chosen} onChange={setProvider} />}
      <dl className="space-y-1 border-t border-line pt-4 text-body-sm">
        {applied && applied.discount > 0 && <div className="flex justify-between text-ink-3"><dt>Price</dt><dd className="tabular-nums line-through">{formatMoney(applied.base, currency)}</dd></div>}
        <div className="flex justify-between text-h4"><dt>Total</dt><dd className="tabular-nums">{total === 0 ? "Free" : formatMoney(total, currency)}</dd></div>
      </dl>
      {state.error && (state.code === "currency_unavailable"
        ? <CurrencyUnavailable currency={currency} alternatives={(state.alternatives ?? []).filter((c) => prices.some((p) => p.currency === c))} reason="payment" />
        : <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}</p>)}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Starting…" : total === 0 ? "Get it free" : `Pay ${formatMoney(total, currency)}`}</Button>
      {total > 0 && <p className="text-caption text-ink-3">You&apos;ll pay in {currency} on the provider&apos;s secure page. It appears in your library as soon as your payment is confirmed.</p>}
    </form>
  );
}
