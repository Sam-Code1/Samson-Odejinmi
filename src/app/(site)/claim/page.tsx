import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { ClaimButton } from "@/components/shop/OrderClient";
import { getUser } from "@/lib/auth";
import { orderForToken, orderItems } from "@/lib/orders";

export const metadata: Metadata = { title: "Add a purchase to your Library", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * Claim a guest purchase into an account. Needs the order's private token (from the receipt or purchase email) AND a
 * signed-in account. Nothing is moved until the buyer presses the button.
 */
export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const wrap = (n: React.ReactNode) => <Container className="pb-24 pt-14 sm:pt-20 lg:pt-24"><div className="mx-auto max-w-2xl">{n}</div></Container>;
  const found = await orderForToken(t);
  if (!found) return wrap(<StateMessage title="This link has expired or isn't valid" body="Enter the email you used at checkout and we'll send you a new private link." action={{ href: "/order/access", label: "Get a new link" }} />);
  const { order } = found;
  if (order.status !== "successful") return wrap(<StateMessage title="This order isn't paid yet" body="Once the payment is confirmed you can add it to your Library." action={{ href: `/order/${t}`, label: "View the order" }} />);
  const [user, items] = await Promise.all([getUser(), orderItems(order.id)]);
  if (order.user_id && user && order.user_id === user.id) return wrap(<StateMessage title="Already in your Library" body="This order is in your account." action={{ href: "/library", label: "Open your Library" }} />);
  if (order.user_id) return wrap(<StateMessage title="This order is in another account" body="Sign in with the account that owns it, or contact us with your order number." action={{ href: "/contact", label: "Contact us" }} />);
  const next = `/claim?t=${t}`;
  return wrap(
    <>
      <h1 className="text-h2">Add this purchase to your Library</h1>
      <p className="mt-3 text-body text-ink-2">Order {order.order_number}: {items.filter((i) => i.unit_minor > 0 || !i.name.endsWith("(in bundle)")).map((i) => i.name).join(", ")}</p>
      {user ? (
        <div className="mt-8">
          <p className="mb-4 text-body-sm text-ink-2">Signed in as <span className="text-ink">{user.email}</span>. Courses in this order become available to start straight away.</p>
          <ClaimButton token={t} />
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={`/register?next=${encodeURIComponent(next)}`}>Create a free account</Button>
          <Button href={`/login?next=${encodeURIComponent(next)}`} variant="secondary">Sign in</Button>
        </div>
      )}
      <p className="mt-6 text-caption text-ink-3">Your download link keeps working either way.</p>
    </>,
  );
}
