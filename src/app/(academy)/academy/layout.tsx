import { Navbar } from "@/components/layout/Navbar";
import { AcademyFooter } from "@/components/layout/AcademyFooter";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { AcademyChatLauncher } from "@/components/ai/AcademyChatLauncher";
import { learnerAiEnabled } from "@/lib/ai/usage";
import { getShopSettings } from "@/lib/products";

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShopSettings();
  return (
    <>
      <PreviewBanner />
      <Navbar variant="academy" hide={shop.enabled ? undefined : ["/academy/shop"]} />
      <main id="main">{children}</main>
      <AcademyFooter />
      {learnerAiEnabled() && <AcademyChatLauncher />}
    </>
  );
}
