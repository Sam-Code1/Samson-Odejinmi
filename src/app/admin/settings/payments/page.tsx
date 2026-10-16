import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { PaymentProviderForm } from "@/components/admin/PaymentProviderForm";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate } from "@/lib/admin/validation";
import { METHOD_LABELS, PROVIDERS, isProviderId, type MethodId, type ProviderId } from "@/lib/payments/providers";
import { site } from "@/lib/site";

export const metadata = { title: "Payment settings" };

const ENV: Record<ProviderId, { secret: string; extra: string[] }> = {
  paystack: { secret: "PAYSTACK_SECRET_KEY", extra: [] },
  flutterwave: { secret: "FLUTTERWAVE_SECRET_KEY", extra: ["FLUTTERWAVE_WEBHOOK_HASH"] },
  palmpay: { secret: "PALMPAY_SECRET_KEY", extra: [] },
};

/** Never shows a secret: only whether it's set, its mode and its last 4 characters. */
function mask(name: string) {
  const v = process.env[name];
  if (!v) return null;
  return `${v.slice(0, v.startsWith("sk_") ? 8 : 4)}••••${v.slice(-4)}`;
}

export default async function PaymentSettingsPage() {
  const ctx = await requirePermission("payments");
  if (!ctx) return null;
  const [{ data, error }, { data: hooks }] = await Promise.all([
    ctx.supabase.from("payment_providers").select("id, enabled, priority, currencies, methods, updated_at").order("priority"),
    ctx.supabase.from("webhook_events").select("provider, outcome, received_at").order("received_at", { ascending: false }).limit(200),
  ]);
  const last = (id: string, outcome?: string) => ((hooks ?? []) as { provider: string; outcome: string; received_at: string }[]).find((h) => h.provider === id && (!outcome || h.outcome === outcome));

  return (
    <>
      <PageHeader eyebrow="Settings" title="Payments" subtitle="Which providers checkout uses, in what order, for which currencies and methods. Keys are set as server environment variables in Vercel and are never shown or stored here." />
      {error ? <AdminError title="Payment settings need migration 0009" body="Run supabase/migrations/0009_batch4_finalization.sql. Until then checkout uses Paystack with PAYSTACK_CURRENCIES, as before." /> : (
        <div className="space-y-10">
          {((data ?? []) as { id: string; enabled: boolean; priority: number; currencies: string[]; methods: string[]; updated_at: string }[]).filter((r) => isProviderId(r.id)).map((r) => {
            const id = r.id as ProviderId;
            const p = PROVIDERS[id];
            const methods = [...new Set(Object.values(p.supports).flat())] as MethodId[];
            const key = mask(ENV[id].secret);
            const lastOk = last(id, "processed"), lastAny = last(id);
            return (
              <section key={id} aria-labelledby={`p-${id}`} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div>
                  <h2 id={`p-${id}`} className="mb-4 text-admin-section">{p.name}</h2>
                  <PaymentProviderForm id={id} name={p.name} enabled={r.enabled} priority={r.priority} currencies={r.currencies} methods={r.methods}
                    supportedCurrencies={Object.keys(p.supports)} supportedMethods={methods.map((m) => ({ id: m, label: METHOD_LABELS[m] }))}
                    disabledReason={id === "palmpay" ? "Not available yet: PalmPay will be added only after confirming an official merchant checkout API for this business. No unofficial integrations." : undefined} />
                </div>
                <Panel title="Connection">
                  <dl className="space-y-3 text-body-sm">
                    <div><dt className="text-caption text-ink-3">{ENV[id].secret}</dt><dd className="break-all font-mono text-caption">{key ?? <span className="font-sans text-warm">Not set</span>}</dd></div>
                    {ENV[id].extra.map((e) => <div key={e}><dt className="text-caption text-ink-3">{e}</dt><dd>{process.env[e] ? "Set" : <span className="text-warm">Not set</span>}</dd></div>)}
                    <div><dt className="text-caption text-ink-3">Mode</dt><dd className="capitalize">{p.mode() ?? "–"}</dd></div>
                    {id !== "palmpay" && <div><dt className="text-caption text-ink-3">Webhook URL</dt><dd className="break-all font-mono text-caption">{site.url}/api/webhooks/{id}</dd></div>}
                    {id !== "palmpay" && <div><dt className="text-caption text-ink-3">Last webhook</dt><dd>{lastAny ? `${formatDate(lastAny.received_at, true)} · ${lastAny.outcome}` : "None received yet"}{lastOk && lastOk !== lastAny ? <span className="block text-caption text-ink-3">Last processed {formatDate(lastOk.received_at, true)}</span> : null}</dd></div>}
                  </dl>
                </Panel>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
