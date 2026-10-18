import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { CurrencySelector } from "@/components/academy/CurrencySelector";
import { readCart } from "@/app/shop-actions";
import { parseItemKey } from "@/lib/cart";
import { cartLines, guestCheckoutEnabled } from "@/lib/cart-view";
import { getShopperCurrency, pickCurrency, CURRENCIES } from "@/lib/currency";
import { getPaymentOptions, publicPayment } from "@/lib/payments/options";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The shop's single checkout (main site + Academy; guests + accounts). `?buy=p:<id>` / `?buy=c:<id>` = Buy Now for one
 * item (the cart is untouched); otherwise the cart. Prices shown here are for display; the database re-prices on submit.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ buy?: string }> }) {
  const { buy } = await searchParams;
  const single = parseItemKey(buy);
  const items = single ? [single] : await readCart();
  const wrap = (n: React.ReactNode) => <Container className="pb-24 pt-14 sm:pt-20 lg:pt-24">{n}</Container>;
  if (!items.length) return wrap(<StateMessage title="Your cart is empty" body="Find something useful in the shop." action={{ href: "/shop", label: "Explore the shop" }} />);

  const [lines, shopper, payOpts, user, guestOk] = await Promise.all([cartLines(items), getShopperCurrency(), getPaymentOptions(), getUser(), guestCheckoutEnabled()]);
  const usable = lines.filter((l) => l.available);
  if (!usable.length) return wrap(<StateMessage title="These items are no longer available" body="Something in your cart was taken off sale." action={{ href: "/shop", label: "Explore the shop" }} />);
  // Currencies every item is priced in.
  const priced = CURRENCIES.filter((c) => usable.every((l) => l.prices[c] !== undefined));
  const currency = shopper.chosen ? shopper.currency : pickCurrency(priced, shopper.currency, shopper.country) ?? shopper.currency;
  const payment = publicPayment(payOpts);

  return wrap(
    <div className="grid gap-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-h2">Checkout</h1>
          <CurrencySelector current={currency} size="sm" />
        </div>
        <p className="mt-3 text-body-sm text-ink-2">{user ? `Signed in as ${user.email}. Your purchase goes straight to your Library.` : "No account needed. Pay, then download straight away. You can create an account afterwards if you like."}</p>
        <div className="mt-8">
          <CheckoutForm
            itemKeys={usable.map((l) => l.key)} lines={usable.map((l) => ({ key: l.key, name: l.name, typeLabel: l.typeLabel, price: l.prices[currency] ?? null }))}
            currency={currency} priced={priced} payment={payment} signedInEmail={user?.email ?? null} guestAllowed={guestOk}
            loginHref={`/login?next=${encodeURIComponent(single ? `/checkout?buy=${buy}` : "/checkout")}`} />
        </div>
      </div>
      <aside className="lg:col-span-5">
        <div className="rounded-xl border border-line bg-elevated p-6 lg:sticky lg:top-24">
          <h2 className="text-h4">How it works</h2>
          <ol className="mt-4 space-y-3 text-body-sm text-ink-2">
            <li>1. Pay securely on your payment provider&apos;s page, in {currency}.</li>
            <li>2. As soon as the payment is confirmed, your receipt opens with your downloads.</li>
            <li>3. We email the receipt with a private link too, so you can come back any time.</li>
          </ol>
          <p className="mt-5 text-caption text-ink-3">Courses need a free account to save your progress; you can create it right after paying.</p>
        </div>
      </aside>
    </div>,
  );
}
