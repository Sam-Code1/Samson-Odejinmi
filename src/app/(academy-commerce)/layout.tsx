import { AcademyChrome } from "@/components/brand/Shell";
import { academyRoot } from "@/app/fonts";
import { getShopSettings } from "@/lib/products";

/** Cart, checkout, receipts and claiming: the Books checkout, in the Fola Academy design. URLs unchanged. */
export default async function AcademyCommerceLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShopSettings();
  return <div className={academyRoot("min-h-screen")}><AcademyChrome hideBooks={!shop.enabled}>{children}</AcademyChrome></div>;
}
