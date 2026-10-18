import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { getSiteSettings, getSocialLinks } from "@/lib/cms";
import { getShopSettings } from "@/lib/products";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, socials, shop] = await Promise.all([getSiteSettings(), getSocialLinks(), getShopSettings()]);
  return (
    <>
      <PreviewBanner />
      <Navbar siteName={settings.siteName} logoUrl={settings.logoUrl} hide={shop.enabled ? undefined : ["/shop"]} />
      <main id="main">{children}</main>
      <Footer settings={settings} socials={socials} />
    </>
  );
}
