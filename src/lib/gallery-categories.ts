/**
 * The portfolio gallery's disciplines and item shape. Every piece of work belongs to ONE category; the categories are
 * fixed here (and in the database check constraint, migration 0016) so pages, filters and the admin agree.
 * No server imports: client components (the admin forms, the gallery viewer) use this file directly.
 */
export const GALLERY_CATEGORIES = [
  { id: "environment-design", label: "Environment design", short: "Environments", group: "3D & animation", blurb: "Lived-in spaces built and lit in Blender: light, material and story in one frame." },
  { id: "product-animation", label: "Product animation", short: "Product", group: "3D & animation", blurb: "Products modelled, lit and animated to show what they are and why they matter." },
  { id: "3d-animation", label: "3D animation & characters", short: "3D animation", group: "3D & animation", blurb: "Characters and motion: modelling, rigging and animation." },
  { id: "graphic-design", label: "Graphic design", short: "Graphic design", group: "Design", blurb: "Campaigns, social design, flyers and brand visuals for real businesses." },
  { id: "video-editing", label: "Video editing", short: "Video", group: "Film", blurb: "Edits, motion graphics and short-form video." },
  { id: "ai-automation", label: "AI automation", short: "AI automation", group: "Technology", blurb: "Workflows and assistants that take repetitive work off people's hands." },
  { id: "software-engineering", label: "Software engineering", short: "Websites", group: "Technology", blurb: "Websites and web apps, designed and built end to end." },
] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]["id"];
export const isGalleryCategory = (v: unknown): v is GalleryCategory => GALLERY_CATEGORIES.some((c) => c.id === v);
export const categoryOf = (id: string) => GALLERY_CATEGORIES.find((c) => c.id === id);

export type GalleryItem = {
  id: string; slug: string; title: string; description?: string | null; category: GalleryCategory; series: string | null;
  kind: "image" | "video"; src: string; poster: string | null; width: number; height: number; tone: string | null;
  featured: boolean; position: number; linkUrl?: string | null;
};
