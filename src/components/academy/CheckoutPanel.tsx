"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { quoteCheckout, startCheckout, type CheckoutState, type Quote } from "@/app/checkout-actions";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Price = { currency: string; amountMinor: number };

/**
 * Enrol / buy panel. Shows the server's own quote (base, discount, total). Submitting starts a server-side checkout;
 * access is granted only after Paystack verification.
 */
export function CheckoutPanel({ courseId, slug, prices, payable, signedIn, enrolled, paymentsReady }: {
  courseId: string; slug: string; prices: Price[]; payable: string[]; signedIn: boolean; enrolled: boolean; paymentsReady: boolean;
}) {
  const options = prices.filter((p) => p.amountMinor === 0 || (paymentsReady && payable.includes(p.currency)));
  const [currency, setCurrency] = useState(options[0]?.currency ?? "");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checking, startCheck] = useTransition();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, {});

  if (enrolled) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-ink-2">You&apos;re enrolled in this course.</p>
        <Button href={`/learn/${slug}`} className="w-full">Go to the course</Button>
      </div>
    );
  }
  if (!options.length) {
    return <p className="text-body-sm text-ink-2">Enrolment for this course isn&apos;t open yet. {signedIn ? "We'll show it here when it opens." : "Create an account now and you'll be ready when it opens."}</p>;
  }
  if (!signedIn) {
    return (
      <div className="space-y-3">
        <Button href={`/register?next=${encodeURIComponent(`/academy/courses/${slug}`)}`} className="w-full">Create an account to enrol</Button>
        <p className="text-caption text-ink-3">Already have one? <a href={`/login?next=${encodeURIComponent(`/academy/courses/${slug}`)}`} className="underline underline-offset-4">Log in</a></p>
      </div>
    );
  }

  const base = options.find((o) => o.currency === currency)?.amountMinor ?? 0;
  const applied = quote?.ok && quote.currency === currency ? quote : null;
  const total = applied ? applied.total : base;

  const apply = () => startCheck(async () => setQuote(await quoteCheckout(courseId, currency, code)));

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="currency" value={currency} />
      {options.length > 1 && (
        <div role="radiogroup" aria-label="Currency" className="flex gap-2">
          {options.map((o) => (
            <button key={o.currency} type="button" role="radio" aria-checked={o.currency === currency} onClick={() => { setCurrency(o.currency); setQuote(null); }}
              className={cn("h-9 rounded border px-3 text-label", o.currency === currency ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:text-ink")}>{o.currency}</button>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="coupon" className="mb-1.5 block text-caption text-ink-3">Coupon code (optional)</label>
        <div className="flex gap-2">
          <input id="coupon" name="coupon" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); }} maxLength={32} autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded border border-line-strong bg-transparent px-3 text-body-sm uppercase tracking-wide focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30" />
          <button type="button" onClick={apply} disabled={!code || checking} className="h-11 rounded border border-line-strong px-4 text-label hover:border-ink disabled:opacity-50">{checking ? "Checking…" : "Apply"}</button>
        </div>
        {quote && !quote.ok && <p role="alert" className="mt-2 text-caption text-warm">{quote.error}</p>}
        {applied && applied.discount > 0 && <p role="status" className="mt-2 text-caption text-blue">{applied.couponCode} applied: {formatMoney(applied.discount, currency)} off.</p>}
      </div>
      <dl className="space-y-1 border-t border-line pt-4 text-body-sm">
        {applied && applied.discount > 0 && <div className="flex justify-between text-ink-3"><dt>Price</dt><dd className="tabular-nums line-through">{formatMoney(applied.base, currency)}</dd></div>}
        <div className="flex justify-between text-h4"><dt>Total</dt><dd className="tabular-nums">{total === 0 ? "Free" : formatMoney(total, currency)}</dd></div>
      </dl>
      {state.error && <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Starting…" : total === 0 ? "Enrol for free" : `Pay ${formatMoney(total, currency)}`}</Button>
      {total > 0 && <p className="text-caption text-ink-3">Secure payment by Paystack. You get access as soon as your payment is confirmed.</p>}
    </form>
  );
}
