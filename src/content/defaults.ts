/**
 * OFFLINE FALLBACK ONLY. The database (Admin → Website) is the source of truth for all of this.
 *
 * These values mirror the seed in supabase/migrations/0003_website_cms.sql and are used only when Supabase isn't
 * configured, or migration 0003 hasn't been run yet, so the public site never breaks during setup.
 * Editing this file does NOT change the live site once the CMS is connected.
 */
import type { PageContent, PageKey, PortfolioProject, Section, SectionItem, Service, SiteSettings } from "@/lib/cms/types";

export const defaultSettings: SiteSettings = {
  siteName: "Samson Odejinmi",
  fullName: "Samson Afolabi Odejinmi",
  jobTitle: "3D Artist, Designer & Creative Technologist",
  description: "A 3D artist, designer and creative technologist exploring the space between visual storytelling and technology.",
  defaultSeoTitle: "Samson Odejinmi — 3D Artist, Designer & Creative Technologist",
  defaultSeoDescription: "Samson Odejinmi is a 3D artist, designer and creative technologist exploring the space between visual storytelling and technology.",
  logoUrl: null,
  faviconUrl: null,
  defaultOgImage: null,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "odejinmisamson37@gmail.com",
  availabilityMessage: null,
  responseExpectation: "I'll reply by email.",
  locationText: null,
  footerText: "A 3D artist, designer and creative technologist exploring the space between visual storytelling and technology.",
  copyrightText: "Samson Afolabi Odejinmi",
};

type Partial_ = Partial<Omit<Section, "key" | "cta" | "cta2" | "status">> & { cta?: [string, string]; cta2?: [string, string] };

function s(key: string, v: Partial_): Section {
  return {
    key, eyebrow: v.eyebrow ?? null, title: v.title ?? null, body: v.body ?? null, imageUrl: v.imageUrl ?? null, imageAlt: v.imageAlt ?? null,
    cta: v.cta ? { label: v.cta[0], href: v.cta[1] } : null, cta2: v.cta2 ? { label: v.cta2[0], href: v.cta2[1] } : null,
    items: v.items ?? [], settings: v.settings ?? {}, status: "published",
  };
}

const t = (...titles: string[]): SectionItem[] => titles.map((title) => ({ title }));

const pages: Record<PageKey, Section[]> = {
  home: [
    s("hero", {
      eyebrow: "3D artist, designer & creative technologist",
      title: "Creating worlds.\nDesigning experiences.\nBuilding what's next.",
      body: "I'm Samson Odejinmi, exploring the space between visual storytelling and technology.",
      cta: ["Explore my work", "/portfolio"], cta2: ["Explore Fola Academy", "/academy"],
      items: [
        { title: "3D Animation", meta: "Core practice", body: "Objects, cameras and scenes brought to life with *deliberate timing* and movement." },
        { title: "Environment Design", meta: "Core practice", body: "Spaces with a sense of place, built for *mood, scale and depth*." },
        { title: "Product Visualisation", meta: "Core practice", body: "Clean, controlled renders that show a product *the way you want it seen*." },
        { title: "Creative Technology", meta: "Exploring", body: "Where I'm headed: procedural 3D and Python, *still being learned* and said plainly." },
      ],
    }),
    s("statement", { title: "I create visual experiences, and I'm increasingly exploring how technology can extend what creativity can do." }),
    s("interactive_3d", {
      eyebrow: "Real-time 3D", title: "Interactive 3D",
      body: "A live 3D scene, running right here in the browser. Move your cursor across it.",
      settings: { scene_url: "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode" },
    }),
    s("selected_work", { title: "Selected work", body: "Drag, or use the arrows. Personal studies are labelled as such.", cta: ["All work", "/portfolio"] }),
    s("about_preview", {
      title: "Creative by instinct. Technical by curiosity.",
      body: "I got interested in 3D and animation around 2020, then trained in 3D Animation and Video Production in Lagos. I care about how things look, and how they're made.\n\nAlongside the creative work I'm studying Computer Science and exploring Python, procedural 3D and Unreal Engine, with Technical Direction as the long-term goal.",
      imageUrl: "/images/samson-odejinmi.jpg", imageAlt: "Portrait of Samson Odejinmi", cta: ["More about me", "/about"],
    }),
    s("disciplines", {
      title: "What I work across", cta: ["", "/services"],
      items: t("3D Animation", "3D Modelling", "Environment Design", "Product Visualisation", "Product Animation", "VFX", "Video Editing", "Graphic Design", "Creative Technology"),
    }),
    s("academy", {
      eyebrow: "Fola Academy", title: "Learn the idea. Understand the process.",
      body: "Fola Academy is where I'm building practical creative education for beginners: structured, patient, and focused on why things work, not only which buttons to press. The first course, Blender Foundations, is in preparation.",
      cta: ["Visit the Academy", "/academy"], cta2: ["See courses", "/academy/courses"], items: t("Understand", "Practise", "Build", "Grow"),
      settings: { featured_course_slug: "" },
    }),
    s("workflow", { title: "How a project goes", body: "3D animation, environments, product visuals, video and design. Every project follows the same five steps.", cta: ["See all services", "/services"] }),
    s("exploring", {
      title: "Currently exploring", body: "Not claims of mastery: what I'm learning right now, and why it matters to where I'm headed.",
      items: [
        { title: "Python", body: "Automating and extending creative workflows." },
        { title: "Procedural 3D", body: "Building with rules and systems instead of by hand." },
        { title: "Unreal Engine", body: "Real-time environments and tooling." },
        { title: "Advanced VFX", body: "Going deeper on effects and integration." },
        { title: "Technical direction", body: "The long-term direction: connecting creative intent to technical systems." },
      ],
    }),
    s("contact_cta", { title: "Have something in mind? Let's talk about it.", cta: ["Get in touch", "/contact"] }),
  ],
  about: [
    s("intro", {
      title: "I make visual things, and I'm learning how technology can take them further.",
      body: "I'm Samson Afolabi Odejinmi, publicly known as Fola. I work in 3D, animation and design, I'm studying Computer Science, and I'm building Fola Academy.",
      imageUrl: "/images/samson-odejinmi.jpg", imageAlt: "Portrait of Samson Odejinmi",
    }),
    s("story", {
      title: "How I got into 3D",
      body: "My interest in animation and 3D started around 2020. I was drawn to it early, but at that point I had limited access to the resources and equipment needed to pursue it fully.\n\nI later trained in 3D Animation and Video Production at Del-York Creative Academy in Lagos, and took part in physical 3D training with YAPI in Lagos in 2024/2025.\n\nToday my interests run across 3D animation, environment design, product visualisation, product animation, video editing, graphic design and visual storytelling.",
    }),
    s("philosophy", {
      title: "How I think about learning",
      body: "My approach to teaching is simple: I want learners to understand what they are doing and why it works, rather than simply memorising which buttons to press.\n\nThat idea sits behind Fola Academy, the educational platform I'm developing to make creative and technical skills easier for beginners through practical, structured, beginner-friendly learning.",
      cta: ["Visit Fola Academy", "/academy"],
    }),
    s("disciplines", { title: "What I work across" }),
    s("exploring", { title: "Currently exploring", body: "Still learning, and being clear about it." }),
    s("timeline", {
      title: "The journey so far",
      items: [
        { meta: "Around 2020", title: "Interest in 3D and animation begins", body: "Curious about the field, but with limited access to the resources and equipment needed to pursue it fully." },
        { meta: "Training", title: "Del-York Creative Academy, Lagos", body: "Trained in 3D Animation and Video Production." },
        { meta: "2024/2025", title: "YAPI, Lagos", body: "Took part in physical 3D training." },
        { meta: "Now", title: "Computer Science, University of the People", body: "Studying toward a foundation in computing alongside creative work." },
        { meta: "Now", title: "Exploring creative technology", body: "Python, procedural 3D, Unreal Engine and advanced VFX, with Technical Direction as the long-term goal." },
        { meta: "In development", title: "Fola Academy", body: "An educational platform for beginners: practical, structured and focused on understanding." },
      ],
    }),
    s("narrio", {
      eyebrow: "Creative Director and Team Lead", title: "NARRIO STUDIO",
      body: "NARRIO STUDIO is a creative team I lead as Creative Director and Team Lead. It's a creative initiative, not a company I work for: a group working across 3D, animation, product animation, environment design, advertising, video and visual storytelling.",
    }),
    s("direction", {
      title: "Where this is going",
      body: "My long-term goal is Technical Direction: the work of connecting creative intent to the technical systems that make it possible. To get there I'm combining 3D, programming and creative technology, and building the foundations properly.",
    }),
    s("contact_cta", { title: "If this sounds like your kind of project, say hello.", cta: ["Get in touch", "/contact"] }),
  ],
  services: [
    s("intro", { title: "Visual work, made with care and a clear process.", body: "Here's what I can make with you, and how the work usually goes." }),
    s("process", {
      title: "How a project goes", body: "Five steps, in order. You always know what happens next.",
      items: [
        { title: "Understand", body: "We talk through what you need, who it's for and where it will be seen." },
        { title: "Plan", body: "I turn that into a clear approach: references, structure and what gets made." },
        { title: "Build", body: "The model, animation, edit or design is made, with check-ins along the way." },
        { title: "Refine", body: "We look at it together and I adjust until it's right." },
        { title: "Deliver", body: "Final files in the formats you need, ready to use." },
      ],
    }),
    s("cta", { title: "Tell me what you're making.", cta: ["Start a conversation", "/contact"] }),
  ],
  contact: [s("intro", { title: "Let's talk about your project.", body: "A few lines about what you're making is enough to start. I'll reply by email." })],
  portfolio: [s("intro", { title: "Work", body: "3D, animation and design. Personal studies are labelled as such." })],
};

export function defaultPage(page: PageKey): PageContent {
  return Object.fromEntries(pages[page].map((x) => [x.key, x]));
}

const svc = (slug: string, name: string, shortDescription: string, deliverables: string[], tools: string[], relatedCategory: string | null): Service => ({
  id: slug, slug, name, shortDescription, fullDescription: null, icon: null, imageUrl: null, deliverables, process: [], tools, relatedCategory,
  ctaLabel: null, ctaHref: null, featured: false, status: "published",
});

export const defaultServices: Service[] = [
  svc("3d-animation", "3D Animation", "Characters, objects and cameras brought to life with deliberate timing and movement.", ["Storyboarding the idea and the shots", "Animating objects, cameras and scenes", "Timing, pacing and polish"], ["Blender"], "3D Animation"),
  svc("environment-design", "Environment Design", "Spaces with a sense of place, built for mood, scale and depth.", ["Gathering reference and defining the mood", "Modelling and dressing the space", "Lighting and composing the final frames"], ["Blender"], "Environment Design"),
  svc("product-visualisation", "Product Visualisation", "Clean, controlled renders that show a product the way you want it seen.", ["Modelling the product accurately", "Materials, lighting and camera setup", "Final stills for web, print or social"], ["Blender"], "Product Visualisation"),
  svc("product-animation", "Product Animation", "Short animated sequences that explain, reveal or showcase a product.", ["Planning the sequence and camera moves", "Animating the product and scene", "Rendering and delivery in the formats you need"], ["Blender"], "Product Animation"),
  svc("vfx", "VFX", "Visual effects that support a story rather than distract from it.", ["Understanding the shot and what the effect needs to do", "Building and integrating the effect", "Refining until it sits naturally in the footage"], [], "VFX"),
  svc("video-editing", "Video Editing", "Footage shaped into something clear, paced and watchable.", ["Structuring the story and the cut", "Pacing, sound and transitions", "Final export for the platform it's going to"], [], "Video"),
  svc("creative-design", "Creative Design", "Graphic design that supports a visual idea: layouts, assets and supporting material.", ["Understanding the message and the audience", "Designing layouts and visual assets", "Preparing files for their final use"], [], "Graphic Design"),
  svc("creative-technology", "Creative Technology", "Where I'm headed: procedural 3D, scripting and tools that extend what a creative workflow can do. This is an area I'm actively developing.", ["Exploring procedural approaches in 3D", "Using Python to automate and extend creative work", "Prototyping ideas where visuals and code meet"], ["Blender", "Python (exploring)", "Unreal Engine (exploring)"], null),
];

const PH = "Placeholder entry. Replace it with a real project in Admin → Website → Portfolio.";
const ph = (slug: string, title: string, shortDescription: string, category: string): PortfolioProject => ({
  id: slug, slug, title, shortDescription, description: PH, challenge: null, approach: null, outcome: null, process: [], category, categories: [category],
  services: [], tools: [], gallery: [], video: null, projectUrl: null, externalUrl: null, year: null, role: null, client: null, projectType: null,
  projectStatus: "Placeholder", placeholder: true, featured: true, status: "published", seoTitle: null, seoDescription: null, updatedAt: null,
});

export const defaultProjects: PortfolioProject[] = [
  ph("product-scene-placeholder", "Product scene", "A lit, composed product render.", "Product Visualisation"),
  ph("environment-placeholder", "Environment study", "A space built for mood and depth.", "Environment Design"),
  ph("animation-placeholder", "Animation test", "Motion, timing and camera.", "3D Animation"),
  ph("vfx-placeholder", "VFX exploration", "Effects and compositing experiments.", "VFX"),
];
