import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { StudioFooter } from "@/components/studio/StudioFooter";
import { getSiteSettings, getSocialLinks } from "@/lib/cms";
import { getShopSettings } from "@/lib/products";
import { studioRoot } from "@/app/fonts";

/** The main Samson Odejinmi website: the studio theme (.st-root), its header and footer. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, socials, shop] = await Promise.all([getSiteSettings(), getSocialLinks(), getShopSettings()]);
  return (
    <div className={studioRoot("min-h-screen")}>
      <PreviewBanner />
      <StudioHeader name={settings.siteName} hide={shop.enabled ? [] : ["/academy/books"]} />
      <main id="main">{children}</main>
      <StudioFooter settings={settings} socials={socials} />
    </div>
  );
}
