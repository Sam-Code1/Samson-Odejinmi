/**
 * What each page section actually uses, so the editor only shows fields that appear on the site.
 * Section rows themselves live in `page_sections` (seeded by migration 0003). Unknown keys fall back to the generic set.
 */
export type ItemFields = { title?: string; body?: string; meta?: string };
export type SectionDef = {
  help?: string;
  fields: ("eyebrow" | "title" | "body" | "image" | "cta" | "cta2")[];
  labels?: Partial<Record<"eyebrow" | "title" | "body" | "cta", string>>;
  items?: { label: string; fields: ItemFields; max: number; help?: string };
  settings?: ("scene_url" | "featured_course_slug")[];
  multilineTitle?: boolean;
};

const generic: SectionDef = { fields: ["eyebrow", "title", "body", "image", "cta", "cta2"] };

export const SECTION_DEFS: Record<string, Record<string, SectionDef>> = {
  home: {
    hero: {
      fields: ["eyebrow", "title", "body", "cta", "cta2"], multilineTitle: true, settings: ["scene_url"],
      help: "The hero is the interactive 3D card: this text on the left, the Spline scene on the right. Clear the scene URL to show the static 3D artwork instead.",
      labels: { eyebrow: "Eyebrow (small badge)", title: "Headline", body: "Supporting text" },
      items: { label: "Capability cards", fields: { title: "Title", body: "Text (*asterisks* = accent)", meta: "Footer label" }, max: 6, help: "The stacked cards over the hero image." },
    },
    statement: { fields: ["title"], labels: { title: "Statement" } },
    selected_work: { fields: ["title", "body", "cta"], help: "Shows portfolio projects marked “Show on homepage”, in portfolio order. Choose and reorder them in Website → Portfolio." },
    about_preview: { fields: ["title", "body", "image", "cta"] },
    disciplines: {
      fields: ["title", "body", "cta"], labels: { cta: "Link (where each item points)" },
      items: { label: "Disciplines", fields: { title: "Name" }, max: 20, help: "Also shown on the About page as skills." },
    },
    academy: {
      fields: ["eyebrow", "title", "body", "cta", "cta2"], settings: ["featured_course_slug"],
      items: { label: "Learning stages", fields: { title: "Stage" }, max: 6 },
    },
    workflow: { fields: ["title", "body", "cta"], help: "The steps themselves are edited under Website → Services → Process, so they stay the same on both pages." },
    exploring: {
      fields: ["title", "body"],
      items: { label: "Topics", fields: { title: "Topic", body: "Why it matters" }, max: 12, help: "Also shown on the About page." },
    },
    contact_cta: { fields: ["title", "cta"] },
  },
  about: {
    intro: { fields: ["title", "body", "image"], labels: { title: "Headline", body: "Introduction" }, help: "Social links from Website → Social links appear under the introduction." },
    story: { fields: ["title", "body"], labels: { body: "Biography" } },
    philosophy: { fields: ["title", "body", "cta"] },
    disciplines: { fields: ["title", "body"], help: "The list itself is edited on the Homepage → Disciplines section." },
    exploring: { fields: ["title", "body"], help: "The topics are edited on the Homepage → Currently exploring section." },
    timeline: {
      fields: ["title", "body"],
      items: { label: "Timeline entries", fields: { meta: "When", title: "Title", body: "Description" }, max: 20, help: "Only real, verifiable milestones." },
    },
    narrio: { fields: ["eyebrow", "title", "body"], labels: { eyebrow: "Role (shown under the heading)" } },
    direction: { fields: ["title", "body"] },
    contact_cta: { fields: ["title", "cta"] },
  },
  services: {
    intro: { fields: ["title", "body"] },
    process: {
      fields: ["title", "body"],
      items: { label: "Steps", fields: { title: "Step", body: "Description" }, max: 8, help: "Shown on the Services page and the homepage." },
    },
    cta: { fields: ["title", "body", "cta"] },
  },
  contact: { intro: { fields: ["title", "body"] } },
  portfolio: { intro: { fields: ["title", "body"] } },
};

export function sectionDef(page: string, key: string): SectionDef {
  return SECTION_DEFS[page]?.[key] ?? generic;
}
