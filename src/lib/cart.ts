/**
 * The cart: a short list of item keys ("p:<product uuid>" or "c:<course uuid>") in a first-party cookie. Works for
 * guests and accounts alike. It holds NO prices: every page and the checkout re-price it on the server, in the
 * shopper's currency, and the database decides what can be bought. One of each item (digital goods are bought once).
 * The cookie is readable by the browser only to show the item count in the header.
 */
export const CART_COOKIE = "fa_cart";
export const CART_MAX = 20;
export type CartItem = { kind: "product" | "course"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseItemKey(key: unknown): CartItem | null {
  if (typeof key !== "string") return null;
  const [k, id] = key.split(":");
  if (!UUID.test(id ?? "")) return null;
  if (k === "p") return { kind: "product", id: id.toLowerCase() };
  if (k === "c") return { kind: "course", id: id.toLowerCase() };
  return null;
}
export const itemKey = (i: CartItem) => `${i.kind === "product" ? "p" : "c"}:${i.id}`;

export function parseCart(raw: string | undefined | null): CartItem[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: CartItem[] = [];
  for (const key of decodeURIComponent(raw).split(",")) {
    const item = parseItemKey(key);
    if (item && !seen.has(itemKey(item))) { seen.add(itemKey(item)); out.push(item); }
    if (out.length >= CART_MAX) break;
  }
  return out;
}
export const serializeCart = (items: CartItem[]) => items.slice(0, CART_MAX).map(itemKey).join(",");
