import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { PageSections, PreviewLink } from "@/components/admin/PageSections";

export const metadata = { title: "About page" };

export default function AboutAdmin() {
  return (
    <>
      <PageHeader eyebrow="Website" title="About"
        subtitle={<>Introduction, biography, philosophy, journey and direction. Keep it factual: no invented clients, awards, jobs or years of experience. Social links come from <Link href="/admin/website/social" className="underline underline-offset-4">Social links</Link>.</>}
        actions={<PreviewLink path="/about" />} />
      <PageSections page="about" />
    </>
  );
}
