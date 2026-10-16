import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fulfilByReference } from "@/lib/payments/fulfil";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Pay = {
  reference: string; status: string; amount_minor: number; currency: string; failure_reason: string | null;
  courses: { title: string; slug: string } | null; products: { name: string; slug: string; product_type: string } | null;
};

/**
 * Where Paystack sends the student after paying. The `reference` in the URL is only a lookup key:
 * the payment must belong to the signed-in student (RLS), and its success is confirmed with Paystack server-side.
 */
export default async function CheckoutCallback({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const reference = String(Array.isArray(sp.reference) ? sp.reference[0] : sp.reference ?? "");
  await requireUser(`/academy/checkout/callback?reference=${encodeURIComponent(reference)}`);
  const wrap = (node: React.ReactNode) => <Container className="py-10">{node}</Container>;

  if (!/^FA-\d{6}-[A-F0-9]{12}$/.test(reference)) {
    return wrap(<StateMessage title="We couldn't find that payment" body="The link looks incomplete. If you paid, check your dashboard or get in touch." action={{ href: "/dashboard", label: "Go to your dashboard" }} secondary={{ href: "/contact", label: "Contact" }} />);
  }

  const supabase = await createClient();
  // Products need migration 0008; before it, fall back to the course-only query so course checkout keeps working.
  const load = async () => {
    const full = await supabase.from("payments").select("reference, status, amount_minor, currency, failure_reason, courses(title, slug), products(name, slug, product_type)").eq("reference", reference).maybeSingle();
    if (!full.error) return full.data as unknown as Pay | null;
    const basic = await supabase.from("payments").select("reference, status, amount_minor, currency, failure_reason, courses(title, slug)").eq("reference", reference).maybeSingle();
    return basic.data ? ({ ...(basic.data as object), products: null } as unknown as Pay) : null;
  };
  let pay = await load();
  if (!pay) return wrap(<StateMessage title="We couldn't find that payment" body="It may belong to a different account. Make sure you're signed in with the account you paid from." action={{ href: "/dashboard", label: "Go to your dashboard" }} />);

  let unavailable = false;
  if (pay.status === "pending") {
    const out = await fulfilByReference(reference);
    unavailable = out.state === "unavailable";
    pay = (await load()) ?? pay;
  }
  const course = pay.courses;
  const product = pay.products;

  if (product && pay.status === "successful") {
    const learn = product.product_type === "course" && course;
    return wrap(<StateMessage title="Payment confirmed. It's yours." body={`Thank you. ${formatMoney(pay.amount_minor, pay.currency)} was received for ${product.name}. Reference ${pay.reference}. A confirmation is on its way to your email.`} action={learn ? { href: `/learn/${course.slug}`, label: "Start learning" } : { href: "/library", label: "Open your library" }} secondary={{ href: "/dashboard", label: "Dashboard" }} />);
  }
  if (product && (pay.status === "failed" || pay.status === "refunded")) {
    return wrap(<StateMessage title="Your payment could not be completed." body={`Please try again. If you were charged, contact us with your reference: ${pay.reference}`} action={{ href: `/academy/shop/${product.slug}`, label: "Try again" }} secondary={{ href: "/contact", label: "Contact" }} />);
  }

  if (pay.status === "successful") {
    return wrap(<StateMessage title="Payment confirmed. You're enrolled." body={`Thank you. ${formatMoney(pay.amount_minor, pay.currency)} was received for ${course?.title ?? "your course"}. Reference ${pay.reference}.`} action={course ? { href: `/learn/${course.slug}`, label: "Start learning" } : { href: "/dashboard", label: "Go to your dashboard" }} secondary={{ href: "/dashboard", label: "Dashboard" }} />);
  }
  if (pay.status === "failed" || pay.status === "refunded") {
    const mismatch = pay.failure_reason === "amount_mismatch";
    return wrap(<StateMessage title="Your payment could not be completed." body={mismatch ? "The amount received didn't match the price, so access wasn't granted. Please contact us with your reference: " + pay.reference : "Please try again. If you were charged, contact us with your reference: " + pay.reference} action={course ? { href: `/academy/courses/${course.slug}`, label: "Try again" } : { href: "/academy/courses", label: "Browse courses" }} secondary={{ href: "/contact", label: "Contact" }} />);
  }
  return wrap(<StateMessage title="We're confirming your payment" body={unavailable ? "Paystack hasn't confirmed it to us yet. This usually takes a moment: refresh this page, or check your dashboard shortly. You won't be charged twice." : "This usually takes a few seconds. Refresh this page in a moment. You won't be charged twice."} action={{ href: `/academy/checkout/callback?reference=${encodeURIComponent(reference)}`, label: "Refresh" }} secondary={{ href: "/dashboard", label: "Dashboard" }} />);
}
