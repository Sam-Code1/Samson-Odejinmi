import { AcademyChrome } from "@/components/brand/Shell";
import { getShopSettings } from "@/lib/products";
import { academyRoot } from "@/app/fonts";

/** The public affiliate programme page is a Fola Academy page: Academy header, type and footer. */
export default async function AffiliatesLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShopSettings();
  return (
    <div className={academyRoot("min-h-screen")}>
      <AcademyChrome hideBooks={!shop.enabled}>{children}</AcademyChrome>
    </div>
  );
}
