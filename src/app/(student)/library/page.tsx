import type { Metadata } from "next";
import Link from "next/link";
import { Download, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StateMessage } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { FILE_TYPES, TYPE_LABELS, type ProductType } from "@/lib/products";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Library", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Ent = { id: string; source: string; granted_at: string; products: { id: string; name: string; slug: string; product_type: ProductType; courses: { slug: string } | null } | null };
type Pay = { reference: string; amount_minor: number; currency: string; status: string; created_at: string; provider: string; products: { name: string } | null; courses: { title: string } | null };

const date = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Everything this person owns (RLS: own rows only) plus their purchase history. Downloads go through the secure route. */
export default async function LibraryPage() {
  await requireUser("/library");
  const supabase = await createClient();
  const [ents, pays] = await Promise.all([
    supabase.from("entitlements").select("id, source, granted_at, products(id, name, slug, product_type, courses(slug))").eq("status", "active").order("granted_at", { ascending: false }),
    supabase.from("payments").select("reference, amount_minor, currency, status, created_at, provider, products(name), courses(title)").in("status", ["successful", "refunded"]).order("created_at", { ascending: false }).limit(50),
  ]);
  if (ents.error) {
    return <StateMessage title="Your library is almost ready" body="Your courses are in My courses. Ebooks and other products will appear here once the shop is switched on." action={{ href: "/courses", label: "My courses" }} />;
  }
  const items = ((ents.data ?? []) as unknown as Ent[]).filter((e) => e.products && e.products.product_type !== "bundle");
  const payments = (pays.data ?? []) as unknown as Pay[];

  return (
    <div className="space-y-16">
      <div>
        <h1 className="text-h1">Library</h1>
        <p className="mt-4 max-w-prose text-body text-ink-2">Everything you&apos;ve bought or been given. Download links are private to you and expire after a minute, so open them from here each time.</p>
      </div>

      {items.length === 0 ? (
        <StateMessage title="Nothing here yet" body="Ebooks, guides and templates you buy appear here, ready to download." action={{ href: "/academy/shop", label: "Browse the shop" }} secondary={{ href: "/courses", label: "My courses" }} />
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
