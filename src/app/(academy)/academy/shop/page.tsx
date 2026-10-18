import { ShopView, shopMetadata } from "@/components/shop/ShopView";

// Academy storefront. Same shop as the main site (/shop): one product system, one checkout. Canonical: /shop.
export const generateMetadata = shopMetadata;

export default async function AcademyShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView base="/academy/shop" surface="academy" searchParams={await searchParams} />;
}
