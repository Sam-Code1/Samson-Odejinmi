import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, Download, PlayCircle, XCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { ClaimButton, ClearPurchasedCart } from "@/components/shop/OrderClient";
import { ReviewForm } from "@/components/shop/Reviews";
import { orderForToken, orderItems } from "@/lib/orders";
import { fulfilByReference } from "@/lib/payments/fulfil";
import { PROVIDERS, isProviderId } from "@/lib/payments/providers";
import { getUser } from "@/lib/auth";
import { itemKey } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * The private receipt for one order (guest or account), reached with its secret access token (this browser's cookie,
 * the confirmation email, or a regenerated link). Shows downloads immediately once the provider has confirmed the
 * payment; an account is offered, never required.
 */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let found = await orderForToken(token);
  const wrap = (n: React.ReactNode) => <Container className="pb-24 pt-14 sm:pt-20 lg:pt-24">{n}</Container>;
  if (!found) {
    return wrap(<StateMessage title="This link has expired or isn't valid" body="Order links are private and expire after 30 days. Enter the email you used at checkout and we'll send you a new one straight away." action={{ href: "/order/access", label: "Get a new link" }} secondary={{ href: "/academy/books", label: "Browse books" }} />);
  }
  // Return from the provider: confirm with the provider server to server (never trusts the redirect itself).
  if (found.order.status === "pending") {
    await fulfilByReference(found.order.reference).catch(() => null);
    found = (await orderForToken(token)) ?? found;
  }
  const { order } = found;
  const [items, user] = await Promise.all([orderItems(order.id), getUser()]);
  const paid = order.status === "successful";
  const guest = !order.user_id;
  const hasCourse = items.some((i) => i.product_type === "course" || i.course_id);
  // Products from this order that can be reviewed through it (courses are reviewed by their account once claimed).
  const reviewable = items.filter((i) => i.product_id && i.product_type && i.product_type !== "course" && i.product_type !== "bundle");
  const provider = isProviderId(order.provider) ? PROVIDERS[order.provider].name : order.provider === "free" ? "Free" : order.provider;

  const status = paid
    ? { icon: CheckCircle2, tone: "text-blue", title: "Purchase successful", body: "Your purchase is confirmed. You can download it now." }
    : order.status === "pending"
      ? { icon: Clock, tone: "text-ink-2", title: "Your payment is being confirmed", body: "This usually takes a few seconds. Refresh this page in a moment. You won't be charged twice." }
      : order.status === "refunded"
        ? { icon: XCircle, tone: "text-ink-3", title: "This order was refunded", body: "The items in it are no longer available to download." }
        : { icon: XCircle, tone: "text-warm", title: "Your payment was not completed", body: order.failure_reason === "amount_mismatch" ? "The amount received didn't match the price, so nothing was delivered. Please contact us with your order number." : "Nothing was charged for this order. You can try again." };
  const Icon = status.icon;

  return wrap(
    <div className="mx-auto max-w-3xl">
      {paid && <ClearPurchasedCart keys={items.map((i) => i.product_id ? itemKey({ kind: "product", id: i.product_id }) : i.course_id ? itemKey({ kind: "course", id: i.course_id }) : "").filter(Boolean)} />}
      <div className="flex items-start gap-4">
        <Icon aria-hidden className={`mt-1 h-7 w-7 shrink-0 ${status.tone}`} strokeWidth={1.5} />
        <div>
          <h1 className="text-h2">{status.title}</h1>
          <p className="mt-2 text-body text-ink-2" role="status">{status.body}</p>
        </div>
      </div>

      <section aria-labelledby="items" className="mt-10 rounded-xl border border-line bg-elevated">
        <h2 id="items" className="sr-only">Items</h2>
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={`${i.product_id ?? i.course_id}-${i.name}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-caption uppercase tracking-wide text-ink-3">{i.product_type === "course" || i.course_id ? "Course" : i.product_type ?? "Item"}</p>
                <p className="mt-0.5 break-words text-h4">{i.name}</p>
                {i.unit_minor > 0 && <p className="mt-0.5 text-caption tabular-nums text-ink-3">{formatMoney(i.unit_minor, order.currency)}</p>}
              </div>
              {paid && (
                i.has_file ? (
                  <a href={`/order/${token}/download/${i.product_id}`} rel="nofollow noreferrer" className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90">
                    <Download aria-hidden className="h-4 w-4" />Download
                  </a>
                ) : (i.product_type === "course" || i.course_id) && i.course_slug ? (
                  guest
                    ? <span className="text-caption text-ink-3 sm:max-w-[14rem] sm:text-right">Create a free account below to start this course.</span>
                    : <Link href={`/learn/${i.course_slug}`} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><PlayCircle aria-hidden className="h-4 w-4" />Start learning</Link>
                ) : i.product_type === "bundle" ? <span className="text-caption text-ink-3">Its contents are listed below.</span> : null
              )}
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line p-5 text-body-sm sm:grid-cols-4">
          <div><dt className="text-caption text-ink-3">Order</dt><dd className="break-all font-medium">{order.order_number}</dd></div>
          <div><dt className="text-caption text-ink-3">Date</dt><dd>{date(order.paid_at ?? order.created_at)}</dd></div>
          <div><dt className="text-caption text-ink-3">Payment</dt><dd>{provider}</dd></div>
          <div><dt className="text-caption text-ink-3">Status</dt><dd>{paid ? "Paid" : order.status === "pending" ? "Confirming" : order.status === "refunded" ? "Refunded" : "Not completed"}</dd></div>
          {order.discount_minor > 0 && <div><dt className="text-caption text-ink-3">Discount</dt><dd className="tabular-nums">−{formatMoney(order.discount_minor, order.currency)}</dd></div>}
          <div className={order.discount_minor > 0 ? "" : "col-span-2 sm:col-span-4"}><dt className="text-caption text-ink-3">Total ({order.currency})</dt><dd className="text-h4 tabular-nums">{order.amount_minor === 0 ? "Free" : formatMoney(order.amount_minor, order.currency)}</dd></div>
        </dl>
      </section>

      {paid && guest && (
        <section aria-labelledby="library" className="mt-10 rounded-xl border border-line p-6">
          <h2 id="library" className="text-h3">{hasCourse ? "Create your account to start learning" : "Want a permanent Library?"}</h2>
          <p className="mt-2 max-w-prose text-body text-ink-2">
            {hasCourse
              ? "Courses keep your progress, quizzes and certificate, so they live in a free Fola Academy account. Create one (or sign in) and this course is added to it."
              : "Create a free Fola Academy account to keep your purchases, courses and downloads in one place. It's optional: your download works without one."}
          </p>
          {user
            ? <div className="mt-5"><ClaimButton token={token} /></div>
            : (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href={`/register?next=${encodeURIComponent(`/claim?t=${token}`)}`}>Create account</Button>
                <Button href={`/login?next=${encodeURIComponent(`/claim?t=${token}`)}`} variant="secondary">I have an account</Button>
                {!hasCourse && <Link href="/academy/books" className="inline-flex min-h-[44px] items-center px-2 text-label text-ink-2 underline underline-offset-4 hover:text-ink">Continue as guest</Link>}
              </div>
            )}
          <p className="mt-4 text-caption text-ink-3">We also emailed this receipt with a private link, so you can come back to your downloads for 30 days, and request a new link any time.</p>
        </section>
      )}
      {paid && reviewable.length > 0 && (
        <section aria-labelledby="review-h" id="review" className="mt-10 scroll-mt-24">
          <h2 id="review-h" className="text-h3">Leave a review</h2>
          <p className="mt-2 text-body-sm text-ink-2">Tell other learners what you thought. Reviews are checked before they appear, and are marked as a verified purchase.</p>
          <div className="mt-5 space-y-3">
            {reviewable.map((i) => (
              <details key={i.product_id} className="group rounded-xl border border-line p-5">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-label">{i.name.replace(/ \(in bundle\)$/, "")}<span aria-hidden className="text-ink-3 group-open:rotate-45 motion-safe:transition-transform">+</span></summary>
                <div className="mt-4"><ReviewForm productId={i.product_id!} token={token} defaultName={order.customer_name ?? ""} /></div>
              </details>
            ))}
          </div>
        </section>
      )}
      {paid && !guest && <p className="mt-8 text-body-sm text-ink-2">It&apos;s also in your <Link href="/library" className="underline underline-offset-4">Library</Link>.</p>}
      {order.status === "failed" && <div className="mt-8 flex flex-wrap gap-3"><Button href="/cart">Try again</Button><Button href="/contact" variant="secondary">Contact us</Button></div>}
      {order.status === "pending" && <div className="mt-8"><Button href={`/order/${token}`}>Refresh</Button></div>}
      <p className="mt-10"><Link href="/academy/books" className="text-label text-ink-2 underline underline-offset-4 hover:text-ink">Continue browsing</Link></p>
    </div>
  );
}
