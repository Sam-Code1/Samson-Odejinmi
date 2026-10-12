import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewServiceForm } from "@/components/admin/WebsiteForms";

export const metadata = { title: "New service" };

export default function NewService() {
  return (
    <>
      <PageHeader eyebrow="Services" title="New service" subtitle={<Link href="/admin/website/services" className="underline underline-offset-4">All services</Link>} />
      <div className="max-w-3xl"><NewServiceForm /></div>
    </>
  );
}
