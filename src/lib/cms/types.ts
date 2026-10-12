/** View models for the public website. Components consume these, never raw database rows. */

export type SiteSettings = {
  siteName: string;
  fullName: string;
  jobTitle: string | null;
  description: string;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  defaultOgImage: string | null;
  contactEmail: string;
  availabilityMessage: string | null;
  responseExpectation: string | null;
  locationText: string | null;
  footerText: string | null;
  copyrightText: string | null;
};

export type SocialLink = { id: string; platform: string; label: string; url: string };

export type SectionItem = { title?: string; body?: string; meta?: string };
export type Cta = { label: string; href: string } | null;

export type PageKey = "home" | "about" | "services" | "contact" | "portfolio";

export type Section = {
  key: string;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  cta: Cta;
  cta2: Cta;
  items: SectionItem[];
  settings: Record<string, unknown>;
  status: "draft" | "published" | "archived";
};

/** Visible sections of a page, keyed by section_key. A missing key means "don't render that block". */
export type PageContent = Record<string, Section>;

export type ImageRef = { src: string; alt: string };

export type PortfolioProject = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string | null;
  challenge: string | null;
  approach: string | null;
  outcome: string | null;
  process: { title: string; body: string }[];
  category: string | null;
  categories: string[];
  services: string[];
  tools: string[];
  coverImage?: ImageRef;
  gallery: (ImageRef & { id: string; caption: string | null })[];
  video: { provider: "youtube"; id: string } | null;
  projectUrl: string | null;
  externalUrl: string | null;
  year: number | null;
  role: string | null;
  client: string | null;
  projectType: string | null;
  projectStatus: string;
  placeholder: boolean;
  featured: boolean;
  status: "draft" | "published" | "archived";
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string | null;
};

export type Service = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  icon: string | null;
  imageUrl: string | null;
  deliverables: string[];
  process: string[];
  tools: string[];
  relatedCategory: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  featured: boolean;
  status: "draft" | "published" | "archived";
};

export type SeoRouteKey = "home" | "about" | "portfolio" | "services" | "contact" | "academy" | "academy_courses";

export type SeoEntry = {
  seoTitle: string | null;
  seoDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
};
