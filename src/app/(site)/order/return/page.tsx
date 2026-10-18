import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { rememberedOrderToken } from "@/lib/orders";
import { fulfilByReference } from "@/lib/payments/fulfil";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Where the payment provider sends the buyer back. The `reference` is only a lookup key: the payment is confirmed with
 * the provider server to server, then this browser goes to its private receipt using the token it was given at
 * checkout (httpOnly cookie). A different browser/device gets the receipt link by email instead.
 */
export default async function OrderReturn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const reference = String(Array.isArray(sp.reference) ? sp.reference[0] : sp.reference ?? "");
  if (/^FA-\d{6}-[A-F0-9]{12}$/.test(reference)) {
    const token = await rememberedOrderToken(reference);
    if (token) {
      await fulfilByReference(reference).catch(() => null);
      redirect(`/order/${token}`);
    }
  }
  return (
    <Container className="pb-24 pt-14 sm:pt-20">
      <StateMessage title="Your payment is being confirmed" body="As soon as it's confirmed we email your receipt with a private download link. It usually arrives within a minute. If you paid on a different device, use that email link." action={{ href: "/order/access", label: "Resend my link" }} secondary={{ href: "/shop", label: "Back to the shop" }} />
    </Container>
  );
}
