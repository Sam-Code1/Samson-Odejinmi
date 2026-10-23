import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { RemoveFromCart } from "@/components/shop/CartClient";
import { CurrencySelector, CurrencyUnavailable } from "@/components/academy/CurrencySelector";
import { readCart } from "@/app/shop-actions";
import { cartLines } from "@/lib/cart-view";
import { getShopperCurrency, pickCurrency, CURRENCIES } from "@/lib/currency";
import { canOptimize } from "@/lib/cms/images";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The cart (guests and accounts). One currency for the whole order; prices re-checked at checkout. */
export default async function CartPage() {
  const items = await readCart();
  const wrap = (n: React.ReactNode) => <Container className="pb-24 pt-14 sm:pt-20 lg:pt-24">{n}</Container>;
  if (!items.length) return wrap(<StateMessage title="Your cart is empty" body="Find something useful in Books." action={{ href: "/academy/books", label: "Explore books" }} />);
  const [lines, shopper] = await Promise.all([cartLines(items), getShopperCurrency()]);
  const usable = lines.filter((l) => l.available);
  const priced = CURRENCIES.filter((c) => usable.length > 0 && usable.every((l) => l.prices[c] !== undefined));
  const currency = shopper.chosen ? shopper.currency : pickCurrency(priced, shopper.currency, shopper.country) ?? shopper.currency;
  const missing = usable.filter((l) => l.prices[currency] === undefined);
  const subtotal = usable.reduce((s, l) => s + (l.prices[currency] ?? 0), 0);

  return wrap(
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-h2">Cart</h1>
        <CurrencySelector current={currency} size="sm" />
      </div>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {lines.map((l) => (
          <li key={l.key} className="flex gap-4 py-5">
            <div className="theme-night spot-stage relative h-20 w-16 shrink-0 overflow-hidden rounded border border-line">
              {l.image && <Image src={l.image} alt="" fill sizes="64px" unoptimized={!canOptimize(l.image)} className="object-contain p-1.5" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 sm:flex-row sm:items-start">
              <div className="min-w-0">
                {l.typeLabel && <p className="text-caption uppercase tracking-wide text-ink-3">{l.typeLabel}</p>}
                {l.href ? <Link href={l.href} className="break-words text-body font-medium hover:underline">{l.name}</Link> : <p className="text-body text-ink-3">{l.name}</p>}
                <div><RemoveFromCart itemKey={l.key} name={l.name} /></div>
              </div>
              <p className="shrink-0 text-body tabular-nums">{!l.available ? "" : l.prices[currency] === undefined ? <span className="text-caption text-ink-3">Not priced in {currency}</span> : l.prices[currency] === 0 ? "Free" : formatMoney(l.prices[currency], currency)}</p>
            </div>
          </li>
        ))}
      </ul>
      {usable.length === 0 ? <p className="mt-6 text-body-sm text-ink-2">Nothing in your cart can be bought right now.</p>
        : missing.length ? <div className="mt-6"><CurrencyUnavailable currency={currency} alternatives={priced} reason="price" /></div>
        : (
          <div className="mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-h4">Subtotal <span className="tabular-nums">{subtotal === 0 ? "Free" : formatMoney(subtotal, currency)}</span></p>
            <Button href="/checkout" size="lg">Checkout</Button>
          </div>
        )}
      <p className="mt-6 text-caption text-ink-3">No account needed to buy. Coupons are applied at checkout.</p>
      <p className="mt-8"><Link href="/academy/books" className="text-label text-ink-2 underline underline-offset-4 hover:text-ink">Continue browsing</Link></p>
    </div>,
  );
}
