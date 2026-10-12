import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { site } from "@/lib/site";
import { themeScript } from "@/lib/theme-script";
import { getSiteSettings } from "@/lib/cms";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope", weight: ["400", "500", "600", "700", "800"] });

/** Site-wide defaults come from Admin → System → Site settings. Pages override them from Admin → Website → SEO. */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const og = s.defaultOgImage ? [{ url: s.defaultOgImage }] : undefined;
  return {
    metadataBase: new URL(site.url),
    title: { default: s.defaultSeoTitle, template: `%s — ${s.siteName}` },
    description: s.defaultSeoDescription,
    applicationName: s.siteName,
    authors: [{ name: s.fullName }],
    openGraph: { type: "website", siteName: s.siteName, title: s.defaultSeoTitle, description: s.defaultSeoDescription, url: site.url, locale: "en", ...(og ? { images: og } : {}) },
    twitter: { card: "summary_large_image", title: s.defaultSeoTitle, description: s.defaultSeoDescription },
    alternates: { canonical: "/" },
    ...(s.faviconUrl ? { icons: { icon: s.faviconUrl } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F2" },
    { media: "(prefers-color-scheme: dark)", color: "#070A12" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        {/* Blocking by design: sets the theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-ink focus:px-4 focus:py-3 focus:text-canvas">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
