"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { placeOrder, quoteOrder, type OrderQuote, type PlaceOrderState } from "@/app/shop-actions";
import { Button } from "@/components/ui/Button";
import { PaymentPicker } from "@/components/academy/PaymentPicker";
import { CurrencyUnavailable } from "@/components/academy/CurrencySelector";
import type { PublicPayment } from "@/lib/payments/options";
import { formatMoney } from "@/lib/utils";
import { BookCover } from "@/components/books/BookParts";
import { SubjectIcon } from "@/components/brand/CourseCard";

type Line = { key: string; name: string; typeLabel: string; price: number | null; image?: string | null; kind?: "product" | "course" };

/**
 * Checkout form. Sends item ids, currency, coupon, email/name (guests) and the preferred provider. Every number shown
 * comes from the server; the database prices the order again on submit.
 */
export function CheckoutForm({ itemKeys, lines, currency, priced, payment, signedInEmail, guestAllowed, loginHref }: {
  itemKeys: string[]; lines: Line[]; currency: string; priced: string[]; payment: PublicPayment; signedInEmail: string | null; guestAllowed: boolean; loginHref: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [provider, setProvider] = useState("");
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [checking, startCheck] = useTransition();
  const [state, action, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, {});
  useEffect(() => { if (state.code === "currency_unavailable") router.refresh(); }, [state, router]);

  const missing = lines.filter((l) => l.price === null);
  const subtotal = lines.reduce((s, l) => s + (l.price ?? 0), 0);
  const payable = (c: string) => priced.includes(c) && (payment.providers[c]?.length ?? 0) > 0;
  const offered = priced.filter((c) => payable(c) || subtotal === 0);
  if (missing.length) return <CurrencyUnavailable currency={currency} alternatives={offered} reason="price" />;
  if (subtotal > 0 && !payable(currency)) return <CurrencyUnavailable currency={currency} alternatives={offered} reason="payment" />;
  if (!signedInEmail && !guestAllowed) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-ink-2">Please sign in to complete this purchase.</p>
        <Button href={loginHref}>Sign in</Button>
      </div>
    );
  }

  const applied = quote?.ok && quote.currency === currency ? quote : null;
  const total = applied ? applied.total : subtotal;
  const providers = payment.providers[currency] ?? [];
  const chosen = providers.some((p) => p.id === provider) ? provider : providers[0]?.id ?? "";
  const apply = () => startCheck(async () => setQuote(await quoteOrder(itemKeys, currency, code, email)));
  const input = "h-12 w-full min-w-0 rounded border border-line-strong bg-transparent px-3 text-base focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30";

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-8">
      <input type="hidden" name="items" value={itemKeys.join(",")} />
      <input type="hidden" name="currency" value={currency} />

      <section aria-labelledby="co-items">
        <h2 id="co-items" className="sr-only">Your order</h2>
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="w-12 shrink-0">{l.kind === "course" ? <div className="fa-dots grid aspect-[2/3] place-items-center rounded-[2px] border border-line"><SubjectIcon subject={l.name} className="h-6 w-6 text-ink" /></div> : <BookCover name={l.name} image={l.image ?? null} type="ebook" sizes="48px" />}</div>
                <div className="min-w-0"><span className="fa-tag">{l.typeLabel}</span><p className="mt-1.5 break-words text-body font-medium">{l.name}</p></div>
              </div>
              <p className="shrink-0 text-body tabular-nums">{l.price === 0 ? "Free" : formatMoney(l.price!, currency)}</p>
            </li>
          ))}
        </ul>
      </section>

      {!signedInEmail && (
        <fieldset className="space-y-4">
          <legend className="text-h4">Your details</legend>
          <div>
            <label htmlFor="co-email" className="mb-1.5 block text-label">Email <span className="text-ink-3">(for your receipt and download link)</span></label>
            <input id="co-email" name="email" type="email" required autoComplete="email" maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); setQuote(null); }} className={input} />
          </div>
          <div>
            <label htmlFor="co-name" className="mb-1.5 block text-label">Name <span className="text-ink-3">(optional)</span></label>
            <input id="co-name" name="name" autoComplete="name" maxLength={120} className={input} />
          </div>
          <p className="text-caption text-ink-3">Already have an account? <Link href={loginHref} className="underline underline-offset-4">Sign in</Link> to keep this in your Library automatically.</p>
        </fieldset>
      )}

      {subtotal > 0 && (
        <div>
          <label htmlFor="co-coupon" className="mb-1.5 block text-label">Coupon code <span className="text-ink-3">(optional)</span></label>
          <div className="flex gap-2">
            <input id="co-coupon" name="coupon" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); }} maxLength={32} autoComplete="off" className={`${input} uppercase tracking-wide`} />
            <button type="button" onClick={apply} disabled={!code || checking} className="h-12 shrink-0 rounded border border-line-strong px-4 text-label hover:border-ink disabled:opacity-50">{checking ? "Checking…" : "Apply"}</button>
          </div>
          {quote && !quote.ok && <p role="alert" className="mt-2 text-caption text-warm">{quote.error}</p>}
          {applied && applied.discount > 0 && <p role="status" className="mt-2 text-caption text-blue">{applied.couponCode} applied: {formatMoney(applied.discount, currency)} off.</p>}
        </div>
      )}

      {total > 0 && <PaymentPicker providers={providers} value={chosen} onChange={setProvider} />}

      <dl className="space-y-1 border-t border-line pt-4 text-body-sm">
        {applied && applied.discount > 0 && <div className="flex justify-between text-ink-3"><dt>Subtotal</dt><dd className="tabular-nums">{formatMoney(applied.subtotal, currency)}</dd></div>}
        {applied && applied.discount > 0 && <div className="flex justify-between text-ink-3"><dt>Discount</dt><dd className="tabular-nums">−{formatMoney(applied.discount, currency)}</dd></div>}
        <div className="flex justify-between text-h4"><dt>Total</dt><dd className="tabular-nums">{total === 0 ? "Free" : formatMoney(total, currency)}</dd></div>
      </dl>

      {state.error && (state.code === "currency_unavailable"
        ? <CurrencyUnavailable currency={currency} alternatives={(state.alternatives ?? []).filter((c) => priced.includes(c))} reason="payment" />
        : <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}{state.code === "already_owned_email" && <> <Link href="/order/access" className="underline underline-offset-4">Send my link</Link></>}</p>)}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Starting secure payment…" : total === 0 ? "Get it free" : `Pay ${formatMoney(total, currency)}`}</Button>
      <p className="text-caption text-ink-3">{total > 0 ? `You'll pay in ${currency} on the provider's secure page. We never see or store your card details.` : "No payment needed."}</p>
    </form>
  );
}
