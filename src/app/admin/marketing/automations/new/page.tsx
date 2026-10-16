import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { AutomationForm } from "@/components/admin/AutomationForm";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "New automation" };

export default async function NewAutomationPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data: products }, { data: courses }] = await Promise.all([
    ctx.supabase.from("products").select("id, name").neq("status", "archived").order("name"),
    ctx.supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Automations" title="New automation" subtitle={<Link href="/admin/marketing/automations" className="underline underline-offset-4">All automations</Link>} />
      <div className="max-w-3xl">
        <AutomationForm products={(products ?? []) as { id: string; name: string }[]} courses={((courses ?? []) as { id: string; title: string }[]).map((c) => ({ id: c.id, name: c.title }))} />
      </div>
    </>
  );
}
