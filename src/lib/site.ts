const clean = (u?: string) => (u ?? "").trim().replace(/\/$/, "");
const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u);
const onVercel = !!(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);

/**
 * NEXT_PUBLIC_SITE_URL, unless it's a localhost address on a Vercel deployment (a copied .env.local); then undefined,
 * so callers fall back to the production domain or the request's own host. Links in emails, certificates and
 * payment callbacks must never point at localhost.
 */
export function envSiteUrl(): string | undefined {
  const configured = clean(process.env.NEXT_PUBLIC_SITE_URL);
  return configured && !(onVercel && isLocal(configured)) ? configured : undefined;
}

/** Vercel's production domain (custom domain if set, else *.vercel.app), on every deployment. */
const vercelProduction = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL);

export const site = {
  name: "Samson Odejinmi",
  fullName: "Samson Afolabi Odejinmi",
  alias: "Fola",
  /** The public address: the configured URL, else the live Vercel domain, else localhost (local development only). */
  url: envSiteUrl() ?? (vercelProduction ? `https://${vercelProduction}` : "http://localhost:3000"),
};

export const mainNav = [
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/academy", label: "Academy" },
  { href: "/academy/books", label: "Books" },
  { href: "/contact", label: "Contact" },
];

export const academyNav = [
  { href: "/academy/courses", label: "Courses" },
  { href: "/academy/books", label: "Books" },
  { href: "/academy#resources", label: "Resources" },
  { href: "/academy#instructor", label: "About" },
  { href: "/dashboard", label: "Student portal" },
];

/** Legal documents (content in src/content/legal.ts), short labels for footers. */
export const legalPages = {
  privacy: "Privacy",
  terms: "Terms of use",
  "academy-terms": "Academy terms",
  "refund-policy": "Refund policy",
  cookies: "Cookies",
} as const;
export const legalLinks = Object.entries(legalPages).map(([slug, label]) => ({ href: `/legal/${slug}`, label }));
