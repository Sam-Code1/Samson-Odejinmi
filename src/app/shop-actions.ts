"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { readAttribution } from "@/lib/attribution-server";
import { checkoutMessage, cleanCode, cleanCurrency, siteBaseUrl, startPayment } from "@/lib/checkout";
import { CART_COOKIE, CART_MAX, itemKey, parseCart, parseItemKey, serializeCart, type CartItem } from "@/lib/cart";
import { issueOrderToken, networkHash, orderForToken, rememberOrder, trackCommerce } from "@/lib/orders";
import { sendOrderConfirmation } from "@/lib/order-email";
import { sendEmail, templates } from "@/lib/email";

/**
 * The shop's ONE checkout (main site and Academy, guests and accounts). The browser sends only item ids, a currency, a
 * coupon code, an email (guests) and a preferred provider. The DATABASE prices the order (create_order), the server
 * picks a capable provider, and access is granted only after the provider confirms the payment server to server.
 */
const db = () => createServiceClient();

// ───────────── cart ─────────────
async function writeCart(items: CartItem[]) {
  (await cookies()).set(CART_COOKIE, serializeCart(items), { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, httpOnly: false });
}
export async function readCart(): Promise<CartItem[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

export async function addToCart(key: string): Promise<{ ok: boolean; count: number; message?: string }> {
  const item = parseItemKey(key);
  const cart = await readCart();
  if (!item) return { ok: false, count: cart.length };
  if (cart.some((c) => itemKey(c) === itemKey(item))) return { ok: true, count: cart.length, message: "Already in your cart." };
  if (cart.length >= CART_MAX) return { ok: false, count: cart.length, message: "Your cart is full." };
  await writeCart([...cart, item]);
  await trackCommerce("add_to_cart", { productId: item.kind === "product" ? item.id : null });
  return { ok: true, count: cart.length + 1 };
}

export async function removeFromCart(key: string): Promise<{ count: number }> {
  const cart = (await readCart()).filter((c) => itemKey(c) !== key);
  await writeCart(cart);
  return { count: cart.length };
}

/** Removes items that were just bought (called from the receipt once the order is paid). */
export async function clearPurchased(keys: string[]): Promise<void> {
  const drop = new Set(keys);
  const cart = await readCart();
  if (cart.some((c) => drop.has(itemKey(c)))) await writeCart(cart.filter((c) => !drop.has(itemKey(c))));
}

// ───────────── quote ─────────────
export type OrderQuote =
  | { ok: true; currency: string; subtotal: number; discount: number; tax: number; total: number; couponCode: string | null; items: { key: string; name: string; unit: number }[] }
  | { ok: false; error: string; code: string };

export async function quoteOrder(keys: string[], currency: string, code: string, email: string): Promise<OrderQuote> {
  const items = parseCart(keys.join(","));
  const service = db();
  if (!service) return { ok: false, error: "Checkout isn't available right now.", code: "unavailable" };
  const user = await getUser();
  const { data, error } = await service.rpc("order_quote", { p_items: items, p_currency: cleanCurrency(currency), p_code: cleanCode(code) || null, p_user: user?.id ?? null, p_email: user ? null : String(email ?? "").slice(0, 254) });
  const q = data as { ok: boolean; error?: string; currency: string; subtotal: number; discount: number; tax: number; total: number; coupon_code: string | null; items: { kind: string; id: string; name: string; unit: number }[] } | null;
  if (error || !q) return { ok: false, error: checkoutMessage(), code: "failed" };
  if (!q.ok) return { ok: false, error: checkoutMessage(q.error), code: q.error ?? "failed" };
  return { ok: true, currency: q.currency, subtotal: q.subtotal, discount: q.discount, tax: q.tax, total: q.total, couponCode: q.coupon_code,
    items: q.items.map((i) => ({ key: itemKey({ kind: i.kind as CartItem["kind"], id: i.id }), name: i.name, unit: i.unit })) };
}

// ───────────── place order ─────────────
export type PlaceOrderState = { error?: string; code?: string; alternatives?: string[] };

export async function placeOrder(_: PlaceOrderState, fd: FormData): Promise<PlaceOrderState> {
  const items = parseCart(String(fd.get("items") ?? ""));
  if (!items.length) return { error: checkoutMessage("empty"), code: "empty" };
  const service = db();
  if (!service) return { error: "Checkout isn't available right now. Please try again later.", code: "unavailable" };
  const user = await getUser();
  const { ref, attribution } = await readAttribution();
  const currency = cleanCurrency(fd.get("currency"));
  const { data, error } = await service.rpc("create_order", {
    p_items: items, p_currency: currency, p_code: cleanCode(fd.get("coupon")) || null, p_user: user?.id ?? null,
    p_email: user ? null : String(fd.get("email") ?? "").slice(0, 254), p_name: String(fd.get("name") ?? "").slice(0, 120),
    p_ref: ref, p_attribution: attribution, p_ip_hash: await networkHash(),
  });
  const r = data as { ok: boolean; error?: string; reference?: string; payment_id?: string; total?: number; currency?: string; email?: string; free?: boolean; guest?: boolean } | null;
  if (error || !r) { console.error("[shop] create_order:", error?.code, error?.message); return { error: checkoutMessage(), code: "failed" }; }
  if (!r.ok) return { error: checkoutMessage(r.error), code: r.error };
  await trackCommerce("checkout_started", { paymentId: r.payment_id, currency: r.currency, guest: !user });

  // This browser's private access to the order (receipt + downloads), remembered for the payment return page.
  const token = await issueOrderToken(r.payment_id!, "browser");
  if (!token) return { error: checkoutMessage(), code: "failed" };
  await rememberOrder(r.reference!, token);

  if (r.free) {
    await sendOrderConfirmation(r.payment_id!);
    redirect(`/order/${token}`);
  }

  const base = await siteBaseUrl();
  const started = await startPayment({
    email: r.email!, total: r.total!, currency: r.currency!, reference: r.reference!, provider: fd.get("provider"),
    metadata: { order: r.reference!, guest: user ? "no" : "yes" },
    returnUrl: `${base}/order/return?reference=${encodeURIComponent(r.reference!)}`,
    record: async (provider, method) => (await service.rpc("set_order_provider", { p_reference: r.reference, p_provider: provider, p_method: method })).data === true,
  });
  if ("error" in started) {
    await service.rpc("cancel_pending_order", { p_reference: r.reference });
    return { error: started.error, code: started.code, alternatives: started.alternatives };
  }
  await trackCommerce("payment_started", { paymentId: r.payment_id, currency: r.currency, provider: started.provider, guest: !user });
  redirect(started.url);
}

// ───────────── new links for a purchase email ─────────────
export type LinkState = { done?: boolean; error?: string };

/**
 * Sends fresh private links for every paid order bought with this email. The answer is the same whether or not
 * there are orders (no way to probe which emails bought something). Links go ONLY to that mailbox.
 */
export async function requestOrderLinks(_: LinkState, fd: FormData): Promise<LinkState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter the email you used at checkout." };
  if (String(fd.get("company") ?? "")) return { done: true }; // bot trap
  const service = db();
  if (!service) return { error: "This isn't available right now. Please try again later." };
  const { data: orders } = await service.from("payments").select("id, order_number").eq("guest_email", email).eq("status", "successful").order("created_at", { ascending: false }).limit(10);
  const list = (orders ?? []) as { id: string; order_number: string }[];
  if (list.length) {
    // At most 3 requests per email per hour.
    const { count } = await service.from("order_access_tokens").select("id", { count: "exact", head: true })
      .in("payment_id", list.map((o) => o.id)).eq("channel", "regenerated").gt("created_at", new Date(Date.now() - 3600e3).toISOString());
    if ((count ?? 0) < 3 * list.length) {
      const base = await siteBaseUrl();
      const links: { orderNumber: string; url: string }[] = [];
      for (const o of list) {
        const t = await issueOrderToken(o.id, "regenerated");
        if (t) links.push({ orderNumber: o.order_number, url: `${base}/order/${t}` });
      }
      if (links.length) await sendEmail({ to: email, ...templates.orderLinks({ links }) });
    }
  }
  return { done: true };
}

// ───────────── claim a guest order into an account ─────────────
export type ClaimState = { error?: string };

/**
 * Adds a guest order to the signed-in account. Requires BOTH a signed-in session AND the order's private token (from
 * the receipt or the purchase email): typing someone's email or order number is never enough.
 */
export async function claimOrder(_: ClaimState, fd: FormData): Promise<ClaimState> {
  const token = String(fd.get("t") ?? "");
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/claim?t=${token}`)}`);
  const found = await orderForToken(token);
  if (!found) return { error: "This link has expired or isn't valid. Ask for a new one with your purchase email." };
  if (found.order.status !== "successful") return { error: "This order isn't paid yet, so it can't be added to your Library." };
  if (found.order.user_id && found.order.user_id !== user.id) return { error: "This order is already in another account." };
  const service = db();
  if (!service) return { error: "This isn't available right now. Please try again later." };
  const { error } = await service.rpc("claim_orders", { p_user: user.id, p_payments: [found.order.id] });
  if (error) { console.error("[shop] claim_orders:", error.code); return { error: "We couldn't add this purchase. Please try again." }; }
  redirect("/library?claimed=1");
}
