import type { PriceRow } from "@/content/course";

/** Product types and display types. Client-safe (no server imports), shared by server pages and client components. */
export const PRODUCT_TYPES = ["course", "ebook", "guide", "template", "download", "bundle"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const TYPE_LABELS: Record<ProductType, string> = {
  course: "Course", ebook: "Ebook", guide: "Guide", template: "Template", download: "Digital download", bundle: "Bundle",
};
/** Types delivered as a file through the secure download route. */
export const FILE_TYPES: ProductType[] = ["ebook", "guide", "template", "download"];

export type ProductCard = {
  id: string; slug: string; name: string; type: ProductType; shortDescription: string | null; coverImage: string | null;
  courseSlug: string | null; prices: PriceRow[]; badge: string | null; featured: boolean; publishedAt: string | null;
};
