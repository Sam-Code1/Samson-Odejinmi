import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinksPanel, type LinkTarget } from "@/components/affiliate/LinksPanel";
import { StateMessage } from "@/components/ui/States";
import { getMyAffiliate, getOffers, offerPath, pct } from "@/lib/affiliate";
import { TYPE_LABELS, type ProductType } from "@/lib/product-types";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Links" };
export const dynamic = "force-dynamic";

const GENERAL: { key: string; label: string; path: string }[] = [
  { key: "g-academy", label: "Fola Academy (home)", path: "/academy" },
  { key: "g-courses", label: "All courses", path: "/academy/courses" },
  { key: "g-books", label: "All books", path: "/academy/books" },
  { key: "g-site", label: "Samson Odejinmi (main site)", path: "/" },
];

/** A tracked link for each product, with what it pays, plus links to the main pages. */
export default async function AffiliateLinks() {
  const { summary: s, unavailable } = await getMyAffiliate();
  if (unavailable) return <StateMessage title="Coming soon" body="The affiliate programme isn't open yet." action={{ href: "/academy", label: "Fola Academy" }} />;
  if (!s) redirect("/affiliate");
  if (s.status !== "active") {
    return (
      <div className="max-w-xl">
        <h1 className="text-h1">Links</h1>
        <p className="mt-5 border-l-2 border-blue pl-4 text-body text-ink-2">
          {s.status === "pending" ? "Your links appear here as soon as your application is approved." : `Your affiliate account is ${s.status}, so links aren't available.`}
        </p>
      </div>
    );
  }
  const offers = await getOffers();
  const targets: LinkTarget[] = [
    ...offers.map((o) => ({ key: `${o.type}-${o.slug}`, label: o.name, kind: TYPE_LABELS[o.type as ProductType] ?? "Product", path: offerPath(o), rate: pct(o.rate_bps) })),
    ...GENERAL.map((g) => ({ ...g, kind: "Page", rate: null })),
  ];
  return (
    <div>
      <p className="fa-label">Links</p>
      <h1 className="mt-3 text-h1">Share a specific product</h1>
      <p className="mt-4 max-w-2xl text-body text-ink-2">Each link takes people straight to that product with your code attached. Whatever they buy within 30 days is credited to you, at the rate shown.</p>
      <div className="mt-8">
        <LinksPanel base={site.url} code={s.code} targets={targets} />
      </div>
    </div>
  );
}
