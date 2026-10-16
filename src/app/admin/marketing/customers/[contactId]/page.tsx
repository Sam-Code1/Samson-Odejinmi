import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminForm } from "@/components/admin/AdminForm";
import { SelectInput, TextAreaInput, TextInput } from "@/components/admin/FormFields";
import { addContactNote, addContactTag, grantProductAccess, removeContactTag, revokeEntitlement, unsubscribeContact } from "@/app/admin/actions/customers";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate, formatMoneyMinor, isUuid } from "@/lib/admin/validation";
import { TYPE_LABELS, type ProductType } from "@/lib/products";

export const metadata = { title: "Customer" };
type Touch = Record<string, string>;
type Contact = {
  id: string; email: string; user_id: string | null; name: string | null; lifecycle: string; orders: number; marketing_consent: boolean; unsubscribed_at: string | null;
  email_status: string; source: string | null; first_touch: Touch; last_touch: Touch; referred_by_affiliate: string | null; created_at: string; last_active_at: string | null; tags: string[] | null;
};

const touch = (t: Touch | null | undefined) => (t && Object.keys(t).length ? [t.source, t.medium, t.campaign && `campaign: ${t.campaign}`, t.ref && `ref: ${t.ref}`, t.at].filter(Boolean).join(" · ") : "Direct / unknown");

export default async function CustomerPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  if (!isUuid(contactId)) notFound();
  const ctx = await requirePermission("customers");
  if (!ctx) return null;
  const { data } = await ctx.supabase.from("customer_overview").select("*").eq("id", contactId).maybeSingle();
  if (!data) notFound();
  const c = data as Contact;
  const uid = c.user_id;
  const [ents, pays, enrols, notes, products, aff, downloads] = await Promise.all([
    uid ? ctx.supabase.from("entitlements").select("id, status, source, granted_at, products!entitlements_product_id_fkey(name, product_type)").eq("user_id", uid).order("granted_at", { ascending: false }) : null,
    uid && ctx.can("payments") ? ctx.supabase.from("payments").select("reference, amount_minor, currency, status, provider, created_at, products(name), courses(title), coupons(code)").eq("user_id", uid).order("created_at", { ascending: false }).limit(50) : null,
    uid ? ctx.supabase.from("enrolments").select("status, granted_at, courses(title)").eq("user_id", uid) : null,
    ctx.supabase.from("contact_notes").select("id, body, created_at, profiles:author_id(email)").eq("contact_id", contactId).order("created_at", { ascending: false }),
    ctx.supabase.from("products").select("id, name").neq("status", "archived").order("name"),
    c.referred_by_affiliate && ctx.can("affiliates") ? ctx.supabase.from("affiliates").select("id, code").eq("id", c.referred_by_affiliate).maybeSingle() : null,
    uid ? ctx.supabase.from("product_downloads").select("created_at, products(name)").eq("user_id", uid).order("created_at", { ascending: false }).limit(10) : null,
  ]);
  const payRows = (pays?.data ?? []) as unknown as { reference: string; amount_minor: number; currency: string; status: string; provider: string; created_at: string; products: { name: string } | null; courses: { title: string } | null; coupons: { code: string } | null }[];
  const spent = new Map<string, number>();
  payRows.filter((p) => p.status === "successful").forEach((p) => spent.set(p.currency, (spent.get(p.currency) ?? 0) + p.amount_minor));
  const optedIn = c.marketing_consent && !c.unsubscribed_at;

  return (
    <>
      <PageHeader eyebrow="Customer" title={c.name || c.email} subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/marketing/customers" className="underline underline-offset-4">All customers</Link><StatusBadge status={c.lifecycle} /><span className="break-all text-caption">{c.email}</span></span>} />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders" value={c.orders} />
        {ctx.can("payments") && <StatCard label="Total spent" value={spent.size ? [...spent].map(([cur, v]) => formatMoneyMinor(v, cur)).join(" · ") : "0"} />}
        <StatCard label="Marketing email" value={optedIn ? "Opted in" : c.unsubscribed_at ? "Unsubscribed" : "Not opted in"} hint={c.email_status !== "ok" ? `Address ${c.email_status}` : undefined} />
        <StatCard label="Account" value={uid ? "Yes" : "Subscriber only"} hint={c.last_active_at ? `Last active ${formatDate(c.last_active_at)}` : undefined} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <Panel title="Products and access">
            {!uid ? <p className="text-body-sm text-ink-3">No account yet, so nothing can be attached.</p> : (
              <>
                {((ents?.data ?? []) as unknown as { id: string; status: string; source: string; granted_at: string; products: { name: string; product_type: ProductType } | null }[]).length === 0
                  ? <p className="text-body-sm text-ink-3">No products.</p>
                  : <ul className="divide-y divide-line">{((ents?.data ?? []) as unknown as { id: string; status: string; source: string; granted_at: string; products: { name: string; product_type: ProductType } | null }[]).map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-body-sm">
                        <span className="min-w-0">{e.products?.name} <span className="text-caption text-ink-3">· {e.products ? TYPE_LABELS[e.products.product_type] : ""} · {e.source} · {formatDate(e.granted_at)}</span></span>
                        <span className="flex items-center gap-2"><StatusBadge status={e.status} />{e.status === "active" && <ActionButton action={revokeEntitlement} fields={{ contactId, entitlementId: e.id }} confirm={{ title: "Remove access?", body: "They'll lose access to this product (logged in the activity log).", label: "Remove" }}>Remove</ActionButton>}</span>
                      </li>
                    ))}</ul>}
                {((enrols?.data ?? []) as unknown as { status: string; courses: { title: string } | null }[]).length > 0 && (
                  <p className="mt-4 text-body-sm text-ink-2">Courses: {((enrols?.data ?? []) as unknown as { status: string; courses: { title: string } | null }[]).map((e) => `${e.courses?.title} (${e.status})`).join(", ")}</p>
                )}
                <div className="mt-5 border-t border-line pt-5">
                  <AdminForm action={grantProductAccess} submitLabel="Give access" stickyBar={false}>
                    <input type="hidden" name="contactId" value={contactId} />
                    <SelectInput label="Give access to a product" name="product_id" defaultValue="" options={[{ value: "", label: "Choose…" }, ...((products.data ?? []) as { id: string; name: string }[]).map((p) => ({ value: p.id, label: p.name }))]} hint="For support cases or gifts. Logged in the activity log." />
                  </AdminForm>
                </div>
              </>
            )}
          </Panel>

          {ctx.can("payments") && uid && (
            <Panel title="Purchases">
              {payRows.length === 0 ? <p className="text-body-sm text-ink-3">No payments.</p> : (
                <ul className="divide-y divide-line">{payRows.map((p) => (
                  <li key={p.reference} className="flex flex-col gap-1 py-2.5 text-body-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">{p.products?.name ?? p.courses?.title ?? "Purchase"}{p.coupons ? <span className="text-caption text-ink-3"> · {p.coupons.code}</span> : null}<span className="block break-all text-caption text-ink-3">{formatDate(p.created_at, true)} · {p.reference}</span></span>
                    <span className="flex items-center gap-2 tabular-nums">{p.provider === "free" ? "Free" : formatMoneyMinor(p.amount_minor, p.currency)}<StatusBadge status={p.status} /></span>
                  </li>
                ))}</ul>
              )}
            </Panel>
          )}

          <Panel title="Notes">
            <AdminForm action={addContactNote} submitLabel="Add note" stickyBar={false}>
              <input type="hidden" name="contactId" value={contactId} />
              <TextAreaInput label="New note" name="body" rows={3} maxLength={4000} className="sm:col-span-2" hint="Visible to staff with customer access. Don't paste passwords or payment details." />
            </AdminForm>
            <ul className="mt-5 space-y-4">{((notes.data ?? []) as unknown as { id: string; body: string; created_at: string; profiles: { email: string } | null }[]).map((n) => (
              <li key={n.id} className="border-l-2 border-line pl-4 text-body-sm"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-caption text-ink-3">{n.profiles?.email ?? "Staff"} · {formatDate(n.created_at, true)}</p></li>
            ))}</ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Tags">
            <div className="flex flex-wrap gap-2">{(c.tags ?? []).length === 0 ? <p className="text-body-sm text-ink-3">No tags.</p> : (c.tags ?? []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line-strong py-0.5 pl-3 pr-1 text-caption">{t}
                <ActionButton action={removeContactTag} fields={{ contactId, tag: t }} ariaLabel={`Remove tag ${t}`} className="h-6 w-6 px-0"><X aria-hidden className="h-3 w-3" /></ActionButton>
              </span>
            ))}</div>
            <div className="mt-4"><AdminForm action={addContactTag} submitLabel="Add tag" stickyBar={false}><input type="hidden" name="contactId" value={contactId} /><TextInput label="Tag" name="tag" maxLength={40} placeholder="vip" /></AdminForm></div>
          </Panel>
          <Panel title="Source">
            <dl className="space-y-3 text-body-sm">
              <div><dt className="text-caption text-ink-3">How they joined</dt><dd className="capitalize">{c.source ?? "–"} · {formatDate(c.created_at)}</dd></div>
              <div><dt className="text-caption text-ink-3">First touch</dt><dd className="break-words">{touch(c.first_touch)}</dd></div>
              <div><dt className="text-caption text-ink-3">Last touch</dt><dd className="break-words">{touch(c.last_touch)}</dd></div>
              {c.referred_by_affiliate && <div><dt className="text-caption text-ink-3">Referred by affiliate</dt><dd>{aff?.data ? <Link href={`/admin/marketing/affiliates/${(aff.data as { id: string }).id}`} className="underline underline-offset-4">{(aff.data as { code: string }).code}</Link> : "Yes"}</dd></div>}
            </dl>
          </Panel>
          <Panel title="Consent">
            <p className="text-body-sm text-ink-2">{optedIn ? "Opted in to marketing email." : c.unsubscribed_at ? `Unsubscribed ${formatDate(c.unsubscribed_at)}.` : "Has not opted in. Staff can't opt people in; they must do it themselves."}</p>
            {optedIn && <div className="mt-4"><ActionButton action={unsubscribeContact} fields={{ contactId }} variant="outline" confirm={{ title: "Unsubscribe on their request?", body: "They'll stop getting marketing email. Use this when they ask you directly.", label: "Unsubscribe" }}>Unsubscribe on request</ActionButton></div>}
          </Panel>
          {(downloads?.data ?? []).length > 0 && (
            <Panel title="Recent downloads">
              <ul className="space-y-2 text-body-sm">{((downloads?.data ?? []) as unknown as { created_at: string; products: { name: string } | null }[]).map((d, i) => <li key={i}>{d.products?.name} <span className="text-caption text-ink-3">· {formatDate(d.created_at, true)}</span></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
