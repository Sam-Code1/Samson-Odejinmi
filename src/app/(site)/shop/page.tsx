import { ShopView, shopMetadata } from "@/components/shop/ShopView";

// Main-site storefront (canonical). Same shop as the Academy (/academy/shop): one product system, one checkout.
export const generateMetadata = shopMetadata;

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView base="/shop" surface="site" searchParams={await searchParams} />;
}
