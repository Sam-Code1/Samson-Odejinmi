import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StateForm } from "@/components/forms/StateForm";
import { Field } from "@/components/forms/Field";
import { CopyButton } from "@/components/admin/CopyButton";
import { StateMessage } from "@/components/ui/States";
import { applyAffiliate, updateAffiliatePayout } from "@/app/marketing-actions";
import { site } from "@/lib/site";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Affiliate programme", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Summary = {
  code: string; status: "pending" | "active" | "suspended" | "rejected"; rate_bps: number; payout_details: string | null; created_at: string;
  clicks_total: number; clicks_30d: number; conversions: number; sales: Record<string, number>;
  commission: { status: string; currency: string; amount: number }[];
  recent: { created_at: string; amount: number; currency: string; status: string }[];
};

const money = (m: Record<string, number>) => (Object.keys(m).length ? Object.entries(m).map(([c, v]) => formatMoney(v, c)).join(" · ") : "0");
const byStatus = (s: Summary, st: string) => {
  const m: Record<string, number> = {};
  s.commission.filter((c) => c.status === st).forEach((c) => { m[c.currency] = (m[c.currency] ?? 0) + Number(c.amount); });
  return money(m);
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-elevated p-5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className="mt-2 text-h3 tabular-nums [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

/** The affiliate's own numbers only (my_affiliate_summary: no buyer identities, no other affiliates). */
export default async function AffiliatePage() {
  await requireUser("/affiliate");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_affiliate_summary");
  if (error) return <StateMessage title="Coming soon" body="The affiliate programme isn't open yet." action={{ href: "/dashboard", label: "Dashboard" }} />;
  const s = data as Summary | null;

  if (!s) {
    return (
      <div className="max-w-xl">
        <h1 className="text-h1">Affiliate programme</h1>
        <p className="mt-5 text-body text-ink-2">Share Fola Academy with your audience and earn a commission on purchases made through your link. Applications are reviewed by hand; you&apos;ll see your link here once you&apos;re approved.</p>
        <ul className="mt-6 space-y-2 text-body-sm text-ink-2">
          <li>· A purchase counts if it&apos;s made within 30 days of someone clicking your link.</li>
          <li>· Commission is on the amount actually paid, after any discount. Your own purchases don&apos;t count.</li>
          <li>· Commissions are approved after the refund window and paid by bank transfer.</li>
        </ul>
        <div className="mt-10">
          <StateForm action={applyAffiliate} submitLabel="Apply" hideOnSuccess>
            <Field label="Your referral code" name="code" hint="3–24 characters: letters, numbers, - or _. It goes in your link, e.g. ?ref=fola123" required />
            <Field label="How should we pay you? (optional)" name="payout" hint="Bank name and account number, for example. Only you and our finance team can see this." />
            <label className="flex min-h-[44px] items-start gap-3 text-body-sm text-ink-2"><input type="checkbox" name="terms" className="mt-1 h-4 w-4 accent-[rgb(var(--blue))]" /><span>I&apos;ve read how the programme works and won&apos;t use spam or misleading claims.</span></label>
          </StateForm>
        </div>
      </div>
    );
  }

  const link = `${site.url}/academy?ref=${s.code}`;
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-h1">Affiliate programme</h1>
        {s.status === "pending" && <p className="mt-4 border-l-2 border-blue pl-4 text-body text-ink-2">Your application (code <strong>{s.code}</strong>) is being reviewed. Your link starts counting once it&apos;s approved.</p>}
        {(s.status === "suspended" || s.status === "rejected") && <p className="mt-4 border-l-2 border-warm pl-4 text-body text-ink-2">Your affiliate account is {s.status}. Purchases through your link aren&apos;t being credited. Contact us if you think this is a mistake.</p>}
      </div>
      {s.status === "active" && (
        <section aria-labelledby="link" className="rounded-xl border border-line bg-elevated p-5 sm:p-6">
          <h2 id="link" className="text-h4">Your link</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded bg-surface px-3 py-2.5 text-body-sm">{link}</code>
            <CopyButton value={link} label="Copy link" className="min-h-[44px] justify-center border border-line-strong px-4" />
          </div>
          <p className="mt-3 text-caption text-ink-3">Add <code>?ref={s.code}</code> to any Fola Academy page link to share a specific course or product. Commission rate: {s.rate_bps / 100}%.</p>
        </section>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Clicks (30 days)" value={s.clicks_30d} />
        <Stat label="Clicks (all time)" value={s.clicks_total} />
        <Stat label="Conversions" value={s.conversions} />
        <Stat label="Sales you referred" value={money(s.sales)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Pending commission" value={byStatus(s, "pending")} />
        <Stat label="Approved (to be paid)" value={byStatus(s, "approved")} />
        <Stat label="Paid to you" value={byStatus(s, "paid")} />
      </div>
      <section aria-labelledby="recent">
        <h2 id="recent" className="text-h3">Recent commissions</h2>
        {s.recent.length === 0 ? <p className="mt-4 text-body-sm text-ink-3">None yet. They appear here as soon as a referred payment is confirmed.</p> : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {s.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-3 text-body-sm">
                <span className="text-ink-2">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="tabular-nums">{formatMoney(r.amount, r.currency)}</span>
                <span className="w-20 text-right capitalize text-ink-3">{r.status}</span>
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
