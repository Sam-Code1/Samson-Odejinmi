import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StateForm } from "@/components/forms/StateForm";
import { Field, TextArea } from "@/components/forms/Field";
import { CopyButton } from "@/components/admin/CopyButton";
import { StateMessage } from "@/components/ui/States";
import { Stat } from "@/components/affiliate/Stat";
import { applyAffiliate } from "@/app/marketing-actions";
import { byStatus, getMyAffiliate, getOffers, money, offerPath, pct } from "@/lib/affiliate";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/** The affiliate's own numbers only (my_affiliate_summary: no buyer identities, no other affiliates). */
export default async function AffiliateOverview() {
  const { summary: s, unavailable } = await getMyAffiliate();
  if (unavailable) return <StateMessage title="Coming soon" body="The affiliate programme isn't open yet." action={{ href: "/academy", label: "Fola Academy" }} />;

  if (!s) {
    return (
      <div className="max-w-xl">
        <p className="fa-label">Affiliate programme</p>
        <h1 className="mt-3 text-h1">Earn by sharing what you believe in.</h1>
        <p className="mt-5 text-body text-ink-2">You don&apos;t need to be a student. Anyone with an account can apply, get a personal link for every course and book, and earn a commission on each sale. Applications are reviewed by hand; your links appear here once you&apos;re approved.</p>
        <p className="mt-4 text-body-sm"><Link href="/affiliates" className="text-blue underline underline-offset-4">See what each product pays</Link></p>
        <ul className="mt-6 space-y-2 text-body-sm text-ink-2">
          <li>· A purchase counts if it&apos;s made within 30 days of someone clicking your link.</li>
          <li>· Commission is on the amount actually paid, after any discount. Your own purchases don&apos;t count.</li>
          <li>· Commissions are approved after the refund window and paid by bank transfer.</li>
        </ul>
        <div className="mt-10">
          <StateForm action={applyAffiliate} submitLabel="Apply" hideOnSuccess>
            <Field label="Your referral code" name="code" hint="3–24 characters: letters, numbers, - or _. It goes in your links, e.g. ?ref=fola123" required autoCapitalize="none" autoCorrect="off" />
            <TextArea label="How will you share Fola Academy?" name="plan" required className="[&_textarea]:min-h-28" maxLength={1000}
              hint="Where you'll post and who you reach, e.g. a YouTube channel, a Blender community, a newsletter, a class you teach. A couple of sentences is plenty." />
            <Field label="How should we pay you? (optional)" name="payout" hint="Bank name and account number, for example. Only you and our finance team can see this." />
            <label className="flex min-h-[44px] items-start gap-3 text-body-sm text-ink-2"><input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-[rgb(var(--blue))]" /><span>I&apos;ve read how the programme works and won&apos;t use spam or misleading claims.</span></label>
          </StateForm>
        </div>
      </div>
    );
  }

  const offers = await getOffers();
  const labelFor = (path: string) => offers.find((o) => offerPath(o) === path)?.name ?? (path === "/academy" ? "Fola Academy home" : path);
  const link = `${site.url}/academy?ref=${s.code}`;
  const top = (s.top_pages ?? []).filter((p) => p.path);

  return (
    <div className="space-y-10">
      <div>
        <p className="fa-label">Affiliate · {s.code}</p>
        <h1 className="mt-3 text-h1">Your affiliate dashboard</h1>
        {s.status === "pending" && <p className="mt-4 border-l-2 border-blue pl-4 text-body text-ink-2">Your application (code <strong>{s.code}</strong>) is being reviewed. Your links start counting once it&apos;s approved. You&apos;ll find them under Links.</p>}
        {(s.status === "suspended" || s.status === "rejected") && <p className="mt-4 border-l-2 border-warm pl-4 text-body text-ink-2">Your affiliate account is {s.status}. Purchases through your links aren&apos;t being credited. Contact us if you think this is a mistake.</p>}
      </div>

      {s.status === "active" && (
        <section aria-labelledby="link" className="rounded-xl border border-line bg-elevated p-5 sm:p-6">
          <h2 id="link" className="text-h4">Your main link</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded bg-surface px-3 py-2.5 text-body-sm">{link}</code>
            <CopyButton value={link} label="Copy link" className="min-h-[44px] justify-center border border-line-strong px-4" />
          </div>
          <p className="mt-3 text-caption text-ink-3">Your own rate is {pct(s.rate_bps)}; some products pay their own rate. Want to promote one product? Get a link for it.</p>
          <Link href="/affiliate/links" className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-blue hover:underline hover:underline-offset-4">Get product links<ArrowRight aria-hidden className="h-4 w-4" /></Link>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Clicks (30 days)" value={s.clicks_30d} />
        <Stat label="Clicks (all time)" value={s.clicks_total} />
        <Stat label="Conversions" value={s.conversions} />
        <Stat label="Sales you referred" value={money(s.sales)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Pending commission" value={byStatus(s, "pending")} />
        <Stat label="Approved (to be paid)" value={byStatus(s, "approved")} />
        <Stat label="Paid to you" value={byStatus(s, "paid")} />
      </div>

      <section aria-labelledby="top">
        <h2 id="top" className="text-h3">What people clicked (30 days)</h2>
        {top.length === 0 ? <p className="mt-4 text-body-sm text-ink-3">Nothing yet. Once people open your links, you&apos;ll see which pages they landed on.</p> : (
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {top.map((p) => (
              <li key={p.path} className="flex items-center justify-between gap-4 py-3 text-body-sm">
                <span className="min-w-0 [overflow-wrap:anywhere]">{labelFor(p.path)}</span>
                <span className="shrink-0 tabular-nums text-ink-2">{p.clicks} click{p.clicks === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
