import type { Metadata } from "next";
import { ProductView, productMetadata } from "@/components/shop/ProductView";

// Academy view of a product. Same product, checkout and reviews as /shop/<slug> (the canonical URL).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return productMetadata((await params).slug);
}

export default async function AcademyProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ reviews?: string }> }) {
  const [{ slug }, { reviews }] = await Promise.all([params, searchParams]);
  return <ProductView slug={slug} base="/academy/shop" reviewPage={Math.max(1, Number.parseInt(reviews ?? "1", 10) || 1)} />;
}
