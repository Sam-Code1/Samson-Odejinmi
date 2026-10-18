import type { Metadata } from "next";
import Link from "next/link";
import { Download, Layers, PlayCircle, Search } from "lucide-react";
import { isAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { fulfilByReference } from "@/lib/payments/fulfil";
import { StateMessage } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { getShopSettings } from "@/lib/products";
import { CATEGORIES, ENROLMENT_SELECT, ENTITLEMENT_SELECT, buildLibrary, bundleChildren, filterLibrary, isMissingTable, type LibraryItem } from "@/lib/library";
import { isUuid } from "@/lib/admin/validation";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Pay = { reference: string; amount_minor: number; currency: string; status: string; created_at: string; provider: string; products: { name: string } | null; courses: { title: string } | null };
type Rows = Record<string, unknown>[];

const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The student's Library: courses (enrolments) and products (entitlements) they own, plus purchase history.
 * Every read uses the student's own session, so RLS limits it to their own rows; downloads and lessons re-check
 * ownership on the server. A failed query is shown as an error, never as an empty library.
 *
 * Access is granted when a payment is confirmed with the provider (return page or webhook). If neither happened (the
 * buyer closed the tab, the webhook isn't set up), the buyer's own recent pending payments are confirmed here, server
 * side, through the same idempotent fulfilment path. Nothing in the browser can mark a payment as paid.
 */
const RETRY_DAYS = 14;
const RETRY_MAX = 5;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : v ?? "");
  const tab = CATEGORIES.some((c) => c.id === one(sp.tab)) ? one(sp.tab) : "all";
  const q = one(sp.q).slice(0, 80);
  const bundle = isUuid(one(sp.bundle)) ? one(sp.bundle) : null;
  const claimed = one(sp.claimed) === "1";

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

  const [ents, enrols, firstPays, shop, admin] = await Promise.all([
    supabase.from("entitlements").select(ENTITLEMENT_SELECT).eq("user_id", user.id).eq("status", "active").order("granted_at", { ascending: false }),
    supabase.from("enrolments").select(ENROLMENT_SELECT).eq("user_id", user.id).in("status", ["active", "completed"]),
    supabase.from("payments").select("reference, amount_minor, currency, status, created_at, provider, products(name), courses(title)").eq("user_id", user.id).in("status", ["successful", "refunded"]).order("created_at", { ascending: false }).limit(50),
    getShopSettings(),
    isAdmin(),
  ]);
  // Before 0008 payments have no product link: list course purchases only.
  const pays = firstPays.error
    ? await supabase.from("payments").select("reference, amount_minor, currency, status, created_at, provider, courses(title)").eq("user_id", user.id).in("status", ["successful", "refunded"]).order("created_at", { ascending: false }).limit(50)
    : firstPays;

  // Only a missing table means "not set up"; any other failure is a real error and is shown (and logged) as one.
  const productsMissing = !!ents.error && isMissingTable(ents.error.code);
  const loadError = (!!ents.error && !productsMissing) || !!enrols.error;
  if (ents.error && !productsMissing) console.error("[library] entitlements query failed:", ents.error.code, ents.error.message);
  if (enrols.error) console.error("[library] enrolments query failed:", enrols.error.code, enrols.error.message);

  const entRows = (ents.error ? [] : ents.data ?? []) as unknown as Rows;
  const all = buildLibrary((enrols.data ?? []) as unknown as Rows, entRows);
  const inBundle = bundle ? bundleChildren(entRows, bundle) : null;
  const bundleItem = bundle ? all.find((i) => i.key === `product:${bundle}`) : null;
  const visible = inBundle ? all.filter((i) => inBundle.has(i.key)) : filterLibrary(all, tab, q);
  const counts: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id === "all" ? all.length : all.filter((i) => i.category === c.id).length]));
  const payments = (pays.data ?? []) as unknown as Pay[];
  const shopOpen = shop.enabled && !productsMissing;

  return (
    <div className="space-y-16">
      <div>
        <h1 className="text-h1">Library</h1>
        <p className="mt-4 max-w-prose text-body text-ink-2">Your courses and everything you&apos;ve bought or been given. Download links are private to you and expire after a minute, so open them from here each time.</p>
      </div>

      {claimed && <p role="status" className="rounded-xl border border-blue/30 bg-elevated p-5 text-body-sm">Your purchase is now in your Library. Courses in it are ready to start.</p>}

      {admin && productsMissing && (
        <div role="note" className="rounded-xl border border-warm/40 bg-elevated p-5 text-body-sm">
          <p className="text-label">Only admins see this: the products tables aren&apos;t set up on this database</p>
          <p className="mt-2 text-ink-2">Run migrations 0008 to 0011 in the Supabase SQL editor. Courses still show below.</p>
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

      {loadError ? (
        <div role="alert" className="rounded-xl border border-warm/40 bg-elevated p-5 text-body-sm">
          <p className="text-label">We couldn&apos;t load your library</p>
          <p className="mt-2 text-ink-2">Your purchases are safe. This is a problem on our side: please refresh in a moment. If it keeps happening, <Link href="/contact" className="underline underline-offset-4">contact us</Link>.</p>
        </div>
      ) : all.length === 0 ? (
        <StateMessage compact title="Your library is empty" body="Courses you enrol in and products you buy will appear here, ready to open or download."
          action={shopOpen ? { href: "/academy/shop", label: "Browse products" } : { href: "/academy/courses", label: "Explore courses" }}
          secondary={shopOpen ? { href: "/academy/courses", label: "Explore courses" } : undefined} />
      ) : (
        <section aria-label="Your items" className="space-y-6">
          {inBundle ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-h3">In {bundleItem?.title ?? "this bundle"}</h2>
              <Link href="/library" className="inline-flex min-h-[44px] items-center text-label underline underline-offset-4">Back to everything</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <nav aria-label="Filter by type" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                {CATEGORIES.filter((c) => c.id === "all" || counts[c.id] > 0).map((c) => (
                  <Link key={c.id} href={{ pathname: "/library", query: { ...(c.id !== "all" ? { tab: c.id } : {}), ...(q ? { q } : {}) } }} aria-current={tab === c.id ? "page" : undefined}
                    className={cn("inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-label", tab === c.id ? "bg-ink text-canvas" : "border border-line text-ink-2 hover:border-ink hover:text-ink")}>
                    {c.label}<span className="tabular-nums opacity-70">{counts[c.id]}</span>
                  </Link>
                ))}
              </nav>
              <form role="search" action="/library" className="relative w-full lg:max-w-xs">
                {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                <label htmlFor="lib-q" className="sr-only">Search your library</label>
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input id="lib-q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search your library"
                  className="h-11 w-full rounded border border-line-strong bg-transparent pl-9 pr-3 text-base placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm" />
              </form>
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-body-sm text-ink-3">{q ? `Nothing matches "${q}".` : "Nothing in this section yet."}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((i) => <LibraryCard key={i.key} item={i} />)}
            </ul>
          )}
        </section>
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

function LibraryCard({ item }: { item: LibraryItem }) {
  const Icon = item.action?.kind === "download" ? Download : item.action?.kind === "contents" ? Layers : PlayCircle;
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-line bg-elevated p-5">
      <Badge className="self-start">{item.typeLabel}</Badge>
      <h3 className="mt-3 break-words text-h4">{item.title}</h3>
      {item.subtitle && <p className="mt-1 line-clamp-2 text-body-sm text-ink-2">{item.subtitle}</p>}
      <p className="mt-1 text-caption text-ink-3">{item.origin}{item.date ? ` · ${date(item.date)}` : ""}</p>
      {item.action && (
        <div className="mt-auto pt-5">
          {item.action.kind === "download" ? (
            <a href={item.action.href} rel="nofollow" className="inline-flex min-h-[44px] items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Icon aria-hidden className="h-4 w-4" />{item.action.label}</a>
          ) : (
            <Link href={item.action.href} className={cn("inline-flex min-h-[44px] items-center gap-2 rounded px-4 text-label", item.action.kind === "contents" ? "border border-line-strong hover:border-ink" : "bg-ink text-canvas hover:bg-ink/90")}><Icon aria-hidden className="h-4 w-4" />{item.action.label}</Link>
          )}
          {item.reviewHref && <Link href={item.reviewHref} className="ml-3 inline-flex min-h-[44px] items-center text-caption text-ink-2 underline underline-offset-4 hover:text-ink">Leave a review</Link>}
        </div>
      )}
    </li>
  );
}
