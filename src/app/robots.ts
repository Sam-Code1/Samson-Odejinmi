import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/certificate", "/verify", "/academy/checkout", "/dashboard", "/courses", "/learn", "/profile", "/settings", "/login", "/register", "/forgot-password", "/reset-password"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
