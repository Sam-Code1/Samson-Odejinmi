import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewProjectForm } from "@/components/admin/WebsiteForms";

export const metadata = { title: "New project" };

export default function NewProject() {
  return (
    <>
      <PageHeader eyebrow="Portfolio" title="New project" subtitle={<Link href="/admin/website/portfolio" className="underline underline-offset-4">All projects</Link>} />
      <div className="max-w-3xl"><NewProjectForm /></div>
    </>
  );
}
