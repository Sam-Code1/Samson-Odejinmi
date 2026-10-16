import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ProductCard } from "@/components/academy/ProductCard";
import { NewsletterSignup } from "@/components/academy/NewsletterSignup";
import { getPublishedProducts, getShopSettings } from "@/lib/products";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopSettings();
  const title = `${shop.seoTitle ?? shop.title} — Fola Academy`;
  const description = shop.seoDescription ?? shop.intro ?? "Ebooks, guides, templates and courses from Fola Academy.";
  return { title: { absolute: title }, description, alternates: { canonical: "/academy/shop" }, openGraph: { title, description, url: "/academy/shop" } };
}

export default async function ShopPage() {
  const [products, shop] = await Promise.all([getPublishedProducts(), getShopSettings()]);
  return (
    <Container className="pb-20 pt-14 sm:pt-20 lg:pt-28">
      <h1 className="text-h1">{shop.title}</h1>
      {shop.intro && <p className="mt-6 max-w-prose text-body-lg text-ink-2">{shop.intro}</p>}
      {products.length === 0 ? (
        <div className="mt-12"><EmptyState title={shop.emptyTitle} body={shop.emptyBody} action={{ href: "/academy/courses", label: "See courses" }} /></div>
      ) : (
        <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => <li key={p.id}><ProductCard product={p} index={i} /></li>)}
        </ul>
      )}
      {shop.showNewsletter && <div className="mt-16 max-w-2xl"><NewsletterSignup {...(shop.newsletterTitle ? { title: shop.newsletterTitle } : {})} {...(shop.newsletterBody ? { body: shop.newsletterBody } : {})} /></div>}
    </Container>
  );
}
