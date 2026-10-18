"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ShoppingBag } from "lucide-react";
import { addToCart, removeFromCart } from "@/app/shop-actions";
import { CART_COOKIE, parseCart } from "@/lib/cart";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const count = () => parseCart(document.cookie.split("; ").find((c) => c.startsWith(`${CART_COOKIE}=`))?.slice(CART_COOKIE.length + 1)).length;

/** Header cart link with the item count (read from the cart cookie in the browser: display only). */
export function CartLink({ className }: { className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const update = () => setN(count());
    update();
    window.addEventListener("fola:cart", update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener("fola:cart", update); window.removeEventListener("focus", update); };
  }, []);
  return (
    <Link href="/cart" aria-label={n ? `Cart, ${n} item${n === 1 ? "" : "s"}` : "Cart"} className={cn("relative inline-flex h-11 w-11 items-center justify-center rounded text-ink-2 hover:text-ink", className)}>
      <ShoppingBag aria-hidden className="h-5 w-5" strokeWidth={1.6} />
      {n > 0 && <span aria-hidden className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-canvas">{n}</span>}
    </Link>
  );
}

/**
 * Buy box for a product or course page: Buy now (straight to checkout, no account needed) and Add to cart.
 * `owned`: the signed-in buyer already has it.
 */
export function BuyButtons({ itemKey, owned, ownedHref, ownedLabel, available, compact = false }: {
  itemKey: string; owned: boolean; ownedHref: string; ownedLabel: string; available: boolean; compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  if (owned) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-ink-2">You already have this.</p>
        <Button href={ownedHref} className="w-full">{ownedLabel}</Button>
      </div>
    );
  }
  if (!available) return null;
  const add = () => start(async () => {
    const r = await addToCart(itemKey);
    window.dispatchEvent(new Event("fola:cart"));
    setNote(r.ok ? (r.message ?? "Added to your cart.") : (r.message ?? "Couldn't add it."));
    router.refresh();
  });
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <Button href={`/checkout?buy=${itemKey}`} className="w-full">Buy now</Button>
        <button type="button" onClick={add} disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded border border-line-strong px-6 text-[0.9375rem] font-medium hover:border-ink disabled:opacity-60">{pending ? "Adding…" : "Add to cart"}</button>
      </div>
      {note && <p role="status" className="text-caption text-ink-2">{note} <Link href="/cart" className="underline underline-offset-4">View cart</Link></p>}
      <p className="text-caption text-ink-3">No account needed. Instant access after payment.</p>
    </div>
  );
}

export function RemoveFromCart({ itemKey, name }: { itemKey: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} aria-label={`Remove ${name}`}
      onClick={() => start(async () => { await removeFromCart(itemKey); window.dispatchEvent(new Event("fola:cart")); router.refresh(); })}
      className="inline-flex min-h-[44px] items-center text-caption text-ink-3 underline underline-offset-4 hover:text-ink disabled:opacity-60">{pending ? "Removing…" : "Remove"}</button>
  );
}
