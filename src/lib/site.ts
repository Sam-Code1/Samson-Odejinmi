export const site = {
  name: "Samson Odejinmi",
  fullName: "Samson Afolabi Odejinmi",
  alias: "Fola",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
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

export const legalPages = {
  privacy: "Privacy policy",
  terms: "Terms",
  "refund-policy": "Refund policy",
} as const;
