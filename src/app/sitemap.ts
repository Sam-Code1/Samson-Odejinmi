import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getProjects, getSeo } from "@/lib/cms";
import { getPublishedCourses } from "@/lib/academy";
import { getPublishedProducts } from "@/lib/products";
import type { SeoRouteKey } from "@/lib/cms/types";

/** Public, published, indexable pages only. Admin, student and account routes are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, projects, products] = await Promise.all([getPublishedCourses(), getProjects(), getPublishedProducts()]);
  const routes: [string, SeoRouteKey][] = [["", "home"], ["/about", "about"], ["/portfolio", "portfolio"], ["/services", "services"], ["/contact", "contact"], ["/academy", "academy"], ["/academy/courses", "academy_courses"]];
  const seo = await Promise.all(routes.map(([, key]) => getSeo(key)));
  return [
    ...routes.filter((_, i) => !seo[i].noindex).map(([p]) => ({ url: `${site.url}${p}`, lastModified: new Date() })),
    ...courses.map((c) => ({ url: `${site.url}/academy/courses/${c.slug}`, lastModified: new Date() })),
    // Shop pages (course products live on their course page). Downloads and the library are never listed.
    ...(products.length ? [{ url: `${site.url}/academy/shop`, lastModified: new Date() }] : []),
    ...products.filter((p) => p.type !== "course").map((p) => ({ url: `${site.url}/academy/shop/${p.slug}`, lastModified: new Date() })),
    ...projects
      .filter((p) => !p.placeholder && p.status === "published")
      .map((p) => ({ url: `${site.url}/portfolio/${p.slug}`, lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date() })),
  ];
}
