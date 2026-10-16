/**
 * What each page section actually uses, so the editor only shows fields that appear on the site.
 * Section rows themselves live in `page_sections` (seeded by migration 0003). Unknown keys fall back to the generic set.
 */
export type ItemFields = { title?: string; body?: string; meta?: string };
export type SectionDef = {
  help?: string;
  fields: ("eyebrow" | "title" | "body" | "image" | "cta" | "cta2")[];
  labels?: Partial<Record<"eyebrow" | "title" | "body" | "cta" | "image", string>>;
  imageHint?: string;
  items?: { label: string; fields: ItemFields; max: number; help?: string };
  settings?: ("scene_url" | "featured_course_slug" | "intro_words" | "backdrop_word" | "game_text")[];
  multilineTitle?: boolean;
};

const generic: SectionDef = { fields: ["eyebrow", "title", "body", "image", "cta", "cta2"] };

export const SECTION_DEFS: Record<string, Record<string, SectionDef>> = {
  home: {
    hero: {
      fields: ["eyebrow", "title", "body", "image", "cta", "cta2"], multilineTitle: true, settings: ["scene_url", "backdrop_word", "intro_words"],
      help: "The hero is the interactive 3D card: this text on the left, the Spline scene on the right. Add a cut-out portrait to show you in front of a giant word instead. Clear the scene URL to show the static 3D artwork.",
      labels: { eyebrow: "Eyebrow (small badge)", title: "Headline", body: "Supporting text", image: "Cut-out portrait (optional)" },
      imageHint: "A PNG or WebP with a transparent background (you, cut out), at least 1000px tall. When set, it replaces the 3D scene and stands in front of the giant word.",
      items: { label: "Capability cards", fields: { title: "Title", body: "Text (*asterisks* = accent)", meta: "Footer label" }, max: 6, help: "The stacked cards over the hero image." },
    },
    statement: { fields: ["title"], labels: { title: "Statement" } },
    selected_work: { fields: ["title", "body", "cta"], help: "Shows portfolio projects marked “Show on homepage”, in portfolio order. Choose and reorder them in Website → Portfolio. Wrap a word of the heading in *asterisks* to set it in italic serif." },
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
    playground: {
      fields: ["eyebrow", "title", "body"], settings: ["game_text"],
      help: "A small block-breaking game. The bricks spell the game text. Set this block to Draft to hide it.",
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
