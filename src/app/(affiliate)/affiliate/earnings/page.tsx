import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StateForm } from "@/components/forms/StateForm";
import { Field } from "@/components/forms/Field";
import { StateMessage } from "@/components/ui/States";
import { Stat } from "@/components/affiliate/Stat";
import { updateAffiliatePayout } from "@/app/marketing-actions";
import { byStatus, getMyAffiliate, pct } from "@/lib/affiliate";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function AffiliateEarnings() {
  const { summary: s, unavailable } = await getMyAffiliate();
  if (unavailable) return <StateMessage title="Coming soon" body="The affiliate programme isn't open yet." action={{ href: "/academy", label: "Fola Academy" }} />;
  if (!s) redirect("/affiliate");

  return (
    <div className="space-y-12">
      <div>
        <p className="fa-label">Earnings</p>
        <h1 className="mt-3 text-h1">Commissions and payout</h1>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Pending commission" value={byStatus(s, "pending")} note="Waiting for the refund window" />
        <Stat label="Approved (to be paid)" value={byStatus(s, "approved")} />
        <Stat label="Paid to you" value={byStatus(s, "paid")} />
      </div>
      <section aria-labelledby="recent">
        <h2 id="recent" className="text-h3">Recent commissions</h2>
        {s.recent.length === 0 ? <p className="mt-4 text-body-sm text-ink-3">None yet. They appear here as soon as a referred payment is confirmed.</p> : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {s.recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-body-sm">
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere]">{r.items || "Sale"}</p>
                  <p className="text-caption text-ink-3">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{r.rate_bps ? ` · ${pct(r.rate_bps)}` : ""}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums">{formatMoney(r.amount, r.currency)}</span>
                  <span className="w-20 text-right capitalize text-ink-3">{r.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="payout" className="max-w-xl">
        <h2 id="payout" className="text-h3">Payout details</h2>
        <div className="mt-5">
          <StateForm action={updateAffiliatePayout} submitLabel="Save payout details" variant="secondary">
            <Field label="Bank or payout details" name="payout" defaultValue={s.payout_details ?? ""} hint="Visible only to you and Fola Academy's finance team." />
          </StateForm>
        </div>
      </section>
    </div>
  );
}
