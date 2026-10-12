import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { PageSections, PreviewLink } from "@/components/admin/PageSections";

export const metadata = { title: "Homepage" };

export default function HomepageAdmin() {
  return (
    <>
      <PageHeader eyebrow="Website" title="Homepage"
        subtitle={<>Every block on the homepage, in order. Selected work comes from <Link href="/admin/website/portfolio" className="underline underline-offset-4">Portfolio</Link> (“Show on homepage”); the project steps come from <Link href="/admin/website/services" className="underline underline-offset-4">Services → Process</Link>.</>}
        actions={<><PreviewLink path="/" /><a href="/" target="_blank" rel="noopener" className="inline-flex h-10 items-center rounded px-3 text-label text-ink-2 hover:text-ink">View live</a></>} />
      <PageSections page="home" />
    </>
  );
}
