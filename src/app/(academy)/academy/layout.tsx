import { AcademyChrome } from "@/components/brand/Shell";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { AcademyChatLauncher } from "@/components/ai/AcademyChatLauncher";
import { learnerAiEnabled } from "@/lib/ai/usage";
import { getShopSettings } from "@/lib/products";
import { academyRoot } from "@/app/fonts";

/** Fola Academy (Brand Guidelines v1.0): Night by default, Paper when the visitor chooses Light. */
export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const shop = await getShopSettings();
  return (
    <div className={academyRoot("min-h-screen")}>
      <PreviewBanner />
      <AcademyChrome hideBooks={!shop.enabled}>{children}</AcademyChrome>
      {learnerAiEnabled() && <AcademyChatLauncher />}
    </div>
  );
}
