import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { getSiteSettings, getSocialLinks } from "@/lib/cms";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, socials] = await Promise.all([getSiteSettings(), getSocialLinks()]);
  return (
    <>
      <PreviewBanner />
      <Navbar siteName={settings.siteName} logoUrl={settings.logoUrl} />
      <main id="main">{children}</main>
      <Footer settings={settings} socials={socials} />
    </>
  );
}
