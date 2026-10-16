import type { Metadata } from "next";
import Link from "next/link";
import { Download, PlayCircle } from "lucide-react";
import { isAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { fulfilByReference } from "@/lib/payments/fulfil";
import { StateMessage } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { FILE_TYPES, TYPE_LABELS, getShopSettings, type ProductType } from "@/lib/products";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Ent = { id: string; source: string; granted_at: string; products: { id: string; name: string; slug: string; product_type: ProductType; courses: { slug: string } | null } | null };
type Pay = { reference: string; amount_minor: number; currency: string; status: string; created_at: string; provider: string; products: { name: string } | null; courses: { title: string } | null };

const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Everything this person owns (RLS: own rows only) plus their purchase history. Downloads go through the secure route.
 * Before migration 0008 there are no products or entitlements yet: students still get a working page (purchases,
 * courses link) and admins see exactly which migration to run.
 *
 * Access is granted when a payment is confirmed with the provider (return page or webhook). If neither happened (the
 * buyer closed the tab, the webhook isn't set up), the buyer's own recent pending payments are confirmed here, server
 * side, through the same idempotent fulfilment path. Nothing in the browser can mark a payment as paid.
 */
const RETRY_DAYS = 14;
const RETRY_MAX = 5;

export default async function LibraryPage() {
  const user = await requireUser("/library");
  const supabase = await createClient();
  const since = new Date(Date.now() - RETRY_DAYS * 864e5).toISOString();
  const { data: pending } = await supabase.from("payments").select("reference").eq("user_id", user.id).eq("status", "pending")
    .neq("provider", "free").gte("created_at", since).order("created_at", { ascending: false }).limit(RETRY_MAX);
  const canConfirm = !!createServiceClient();
  if (pending?.length && canConfirm) {
    await Promise.all(pending.map((p) => fulfilByReference(p.reference as string).catch(() => null)));
  }
  const { data: stillPending } = pending?.length
    ? await supabase.from("payments").select("reference, amount_minor, currency, created_at").eq("user_id", user.id).eq("status", "pending").gte("created_at", since).order("created_at", { ascending: false }).limit(RETRY_MAX)
    : { data: [] };
  const waiting = (stillPending ?? []) as { reference: string; amount_minor: number; currency: string; created_at: string }[];

  const [ents, firstPays, shop] = await Promise.all([
    supabase.from("entitlements").select("id, source, granted_at, products(id, name, slug, product_type, courses(slug))").eq("status", "active").order("granted_at", { ascending: false }),
    supabase.from("payments").select("reference, amount_minor, currency, status, created_at, provider, products(name), courses(title)").in("status", ["successful", "refunded"]).order("created_at", { ascending: false }).limit(50),
    getShopSettings(),
  ]);
  // Before 0008 payments have no product link: list course purchases only.
  const pays = firstPays.error
    ? await supabase.from("payments").select("reference, amount_minor, currency, status, created_at, provider, courses(title)").in("status", ["successful", "refunded"]).order("created_at", { ascending: false }).limit(50)
    : firstPays;
  const admin = await isAdmin();
  const setupNeeded = !!ents.error && admin;
  const items = ents.error ? [] : ((ents.data ?? []) as unknown as Ent[]).filter((e) => e.products && e.products.product_type !== "bundle");
  const payments = (pays.data ?? []) as unknown as Pay[];
  const shopOpen = shop.enabled && !ents.error;

  return (
    <div className="space-y-16">
      <div>
        <h1 className="text-h1">Library</h1>
        <p className="mt-4 max-w-prose text-body text-ink-2">Everything you&apos;ve bought or been given. Download links are private to you and expire after a minute, so open them from here each time.</p>
      </div>

      {setupNeeded && (
        <div role="note" className="rounded-xl border border-warm/40 bg-elevated p-5 text-body-sm">
          <p className="text-label">Only admins see this: the shop&apos;s database tables aren&apos;t set up yet</p>
          <p className="mt-2 text-ink-2">Run the migrations 0008, 0009 and 0010 (in that order) in the Supabase SQL editor. Then open the shop from Admin → Products → Shop settings. Students see an ordinary empty library until then.</p>
          <Link href="/admin/products/shop" className="mt-3 inline-flex min-h-[44px] items-center text-label underline underline-offset-4">Open shop settings</Link>
        </div>
      )}

      {admin && !canConfirm && (
        <div role="note" className="rounded-xl border border-warm/40 bg-elevated p-5 text-body-sm">
          <p className="text-label">Only admins see this: purchases can&apos;t be delivered</p>
          <p className="mt-2 text-ink-2">SUPABASE_SERVICE_ROLE_KEY isn&apos;t set on this deployment, so paid orders can&apos;t be confirmed and files can&apos;t be downloaded. Add it in Vercel → Settings → Environment Variables (Supabase → Project Settings → API → service_role), then redeploy. Buyers&apos; pending payments are confirmed automatically the next time they open their Library.</p>
        </div>
      )}

      {waiting.length > 0 && (
        <section aria-labelledby="waiting" className="rounded-xl border border-line bg-elevated p-5 text-body-sm">
          <h2 id="waiting" className="text-label">Waiting for payment confirmation</h2>
          <p className="mt-2 text-ink-2">We haven&apos;t received confirmation from the payment provider for {waiting.length === 1 ? "this order" : "these orders"} yet. If you completed the payment, it will appear here shortly: refresh this page in a minute. You won&apos;t be charged twice. If it doesn&apos;t appear, <Link href="/contact" className="underline underline-offset-4">contact us</Link> with the reference.</p>
          <ul className="mt-3 space-y-1 text-caption text-ink-3">
            {waiting.map((w) => <li key={w.reference} className="break-all">{date(w.created_at)} · {formatMoney(w.amount_minor, w.currency)} · {w.reference}</li>)}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        shopOpen
          ? <StateMessage compact title="Nothing here yet" body="Ebooks, guides and templates you buy appear here, ready to download." action={{ href: "/academy/shop", label: "Browse the shop" }} secondary={{ href: "/courses", label: "My courses" }} />
          : <StateMessage compact title="Nothing here yet" body="Anything you buy or are given will appear here. Your courses are in My courses." action={{ href: "/courses", label: "My courses" }} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => {
            const p = e.products!;
            const file = FILE_TYPES.includes(p.product_type);
            return (
              <li key={e.id} className="flex flex-col rounded-xl border border-line bg-elevated p-5">
                <Badge className="self-start">{TYPE_LABELS[p.product_type]}</Badge>
                <h2 className="mt-3 text-h4">{p.name}</h2>
                <p className="mt-1 text-caption text-ink-3">{e.source === "bundle" ? "Part of a bundle" : e.source === "manual" ? "Added by Fola Academy" : "Purchased"} · {date(e.granted_at)}</p>
                <div className="mt-auto pt-5">
                  {file ? (
                    <a href={`/api/products/${p.id}/download`} rel="nofollow" className="inline-flex min-h-[44px] items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Download aria-hidden className="h-4 w-4" />Download</a>
                  ) : p.product_type === "course" && p.courses ? (
                    <Link href={`/learn/${p.courses.slug}`} className="inline-flex min-h-[44px] items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><PlayCircle aria-hidden className="h-4 w-4" />Open course</Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="purchases">
        <h2 id="purchases" className="text-h3">Purchases</h2>
        {payments.length === 0 ? <p className="mt-4 text-body-sm text-ink-3">No purchases yet.</p> : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {payments.map((pay) => (
              <li key={pay.reference} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium">{pay.products?.name ?? pay.courses?.title ?? "Purchase"}</p>
                  <p className="break-all text-caption text-ink-3">{date(pay.created_at)} · {pay.reference}</p>
                </div>
                <p className="text-body-sm tabular-nums text-ink-2">{pay.provider === "free" ? "Free" : formatMoney(pay.amount_minor, pay.currency)}{pay.status === "refunded" ? " · refunded" : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
