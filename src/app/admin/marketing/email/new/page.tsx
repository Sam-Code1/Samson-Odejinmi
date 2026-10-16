import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmailCampaignForm } from "@/components/admin/EmailForms";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "New email" };

export default async function NewEmailPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data: segs }, { data: camps }] = await Promise.all([
    ctx.supabase.from("segments").select("id, name").order("name"),
    ctx.supabase.from("marketing_campaigns").select("id, name").neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Email" title="New email" subtitle={<Link href="/admin/marketing/email" className="underline underline-offset-4">All emails</Link>} />
      <div className="max-w-3xl"><EmailCampaignForm segments={(segs ?? []) as { id: string; name: string }[]} campaigns={(camps ?? []) as { id: string; name: string }[]} /></div>
    </>
  );
}
