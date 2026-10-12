import type { Metadata } from "next";
import { getSeo, getSiteSettings } from "./index";
import type { SeoRouteKey } from "./types";

/**
 * Page metadata from the CMS (Admin → Website → SEO), falling back to sensible per-page defaults and then to the
 * site-wide defaults in Site settings. `absoluteTitle` is used for the homepage, which doesn't take the "— Site" suffix.
 */
export async function buildMetadata(key: SeoRouteKey, fallback: { title?: string; description?: string; path: string; absoluteTitle?: boolean }): Promise<Metadata> {
  const [seo, settings] = await Promise.all([getSeo(key), getSiteSettings()]);
  const title = seo.seoTitle ?? fallback.title ?? settings.defaultSeoTitle;
  const description = seo.seoDescription ?? fallback.description ?? settings.defaultSeoDescription;
  const ogImage = seo.ogImage ?? settings.defaultOgImage;
  return {
    title: fallback.absoluteTitle || seo.seoTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: seo.canonicalUrl ?? fallback.path },
    openGraph: {
      title: seo.ogTitle ?? title,
      description: seo.ogDescription ?? description,
      url: fallback.path,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { title: seo.ogTitle ?? title, description: seo.ogDescription ?? description, ...(ogImage ? { images: [ogImage] } : {}) },
    robots: seo.noindex ? { index: false, follow: true } : undefined,
  };
}
