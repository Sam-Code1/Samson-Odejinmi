import { Navbar } from "@/components/layout/Navbar";
import { AcademyFooter } from "@/components/layout/AcademyFooter";
import { PreviewBanner } from "@/components/layout/PreviewBanner";

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PreviewBanner />
      <Navbar variant="academy" />
      <main id="main">{children}</main>
      <AcademyFooter />
    </>
  );
}
