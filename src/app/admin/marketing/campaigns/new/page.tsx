import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { CampaignForm } from "@/components/admin/MarketingForms";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  if (!(await requirePermission("marketing"))) return null;
  return (
    <>
      <PageHeader eyebrow="Campaigns" title="New campaign" subtitle={<Link href="/admin/marketing/campaigns" className="underline underline-offset-4">All campaigns</Link>} />
      <div className="max-w-3xl"><CampaignForm /></div>
    </>
  );
}
