import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, Store } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionButton } from "@/components/admin/ActionButton";
import { ShopSettingsForm, type ShopSettingsRow } from "@/components/admin/ProductForms";
import { setShopOpen } from "@/app/admin/actions/products";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "Shop settings" };

const STEPS = [
  { file: "0008_batch3_products_marketing.sql", what: "Products, entitlements (the Library), private product files, product checkout" },
  { file: "0009_batch4_finalization.sql", what: "Shop settings, product details, payment providers, notifications" },
  { file: "0010_shop_switch.sql", what: "The shop on/off switch (closing it also blocks new product checkouts in the database)" },
];

export default async function ShopSettingsPage() {
  const ctx = await requirePermission("products");
  if (!ctx) return null;
  const [products, settings] = await Promise.all([
    ctx.supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "published"),
    ctx.supabase.from("shop_settings").select("*").eq("id", true).maybeSingle(),
  ]);
  const row = settings.data as (ShopSettingsRow & Record<string, unknown>) | null;
  // What's applied on this database, read from the database itself.
  const done = [!products.error, !settings.error && !!row, !!row && "enabled" in row];
  const ready = done.every(Boolean);
  const open = row?.enabled !== false;
  const published = products.count ?? 0;

  return (
    <>
      <PageHeader eyebrow="Sales" title="Shop settings" subtitle={<>Open or close the shop, and set the shop page&apos;s title, introduction, empty state and email sign-up. Products, prices, order and featured items are set on each product. <Link href="/admin/products" className="underline underline-offset-4">All products</Link></>}
        actions={<a href="/academy/shop" target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink">View shop<ExternalLink aria-hidden className="h-3.5 w-3.5" /></a>} />

      <div className="max-w-3xl space-y-8">
        {!ready && (
          <section aria-labelledby="setup" className="rounded-xl border border-warm/40 bg-elevated p-5 sm:p-6">
            <h2 id="setup" className="text-h4">Finish the shop setup</h2>
            <p className="mt-2 text-body-sm text-ink-2">
              These database updates haven&apos;t all been run on this Supabase project yet. Until they are, the shop can&apos;t open and students&apos; Library has nothing to show.
              In Supabase, open <strong>SQL Editor → New query</strong>, paste each file from <code>supabase/migrations/</code> in this order, and press <strong>Run</strong>. Each one is safe to run again. Then refresh this page.
            </p>
            <ol className="mt-5 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.file} className="flex gap-3">
                  {done[i] ? <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-blue" /> : <Circle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" />}
                  <div className="min-w-0">
                    <p className="break-all text-label">{s.file} <span className="text-caption font-normal text-ink-3">{done[i] ? "· done" : "· not run yet"}</span></p>
                    <p className="text-body-sm text-ink-2">{s.what}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-caption text-ink-3">If 0006 or 0007 haven&apos;t been run either, run them first: every file goes in number order.</p>
          </section>
        )}

        {ready && (
          <section aria-labelledby="status" className="flex flex-col gap-5 rounded-xl border border-line bg-elevated p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <Store aria-hidden className={open ? "mt-0.5 h-5 w-5 shrink-0 text-blue" : "mt-0.5 h-5 w-5 shrink-0 text-ink-3"} />
              <div>
                <h2 id="status" className="text-h4">{open ? "The shop is open" : "The shop is closed"}</h2>
                <p className="mt-1 text-body-sm text-ink-2">
                  {open
                    ? `Visitors can browse and buy. ${published === 0 ? "No products are published yet, so the shop shows its empty message." : `${published} published product${published === 1 ? "" : "s"}.`}`
                    : "The Shop link is hidden, shop and product pages show your closed message, and no new product can be bought. Past purchases and downloads keep working; course checkout is not affected."}
                </p>
              </div>
            </div>
            <ActionButton action={setShopOpen} fields={{ open: open ? "0" : "1" }} variant={open ? "danger" : "primary"} className="h-10 shrink-0 px-4 text-label"
              confirm={open
                ? { title: "Close the shop?", body: "The Shop link disappears and nobody can start a new product purchase until you open it again. Existing purchases and downloads keep working.", label: "Close the shop" }
                : undefined}>
              {open ? "Close the shop" : "Open the shop"}
            </ActionButton>
          </section>
        )}

        {row && <ShopSettingsForm s={row} />}
      </div>
    </>
  );
}
