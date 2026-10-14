import { Navbar } from "@/components/layout/Navbar";
import { AcademyFooter } from "@/components/layout/AcademyFooter";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { AcademyChatLauncher } from "@/components/ai/AcademyChatLauncher";
import { learnerAiEnabled } from "@/lib/ai/usage";

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PreviewBanner />
      <Navbar variant="academy" />
      <main id="main">{children}</main>
      <AcademyFooter />
      {learnerAiEnabled() && <AcademyChatLauncher />}
    </>
  );
}
