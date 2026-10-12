import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { PreviewLink } from "@/components/admin/PageSections";
import { ServiceForm, type ServiceRow } from "@/components/admin/WebsiteForms";
import { deleteService, setServiceStatus } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";
import { isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Edit service" };

export default async function EditService({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  if (!isUuid(serviceId)) notFound();
  const ctx = (await getAdminContext())!;
  const [{ data }, library, { data: cats }] = await Promise.all([
    ctx.supabase.from("services").select("*").eq("id", serviceId).maybeSingle(),
    getLibraryImages(ctx),
    ctx.supabase.from("portfolio_projects").select("categories"),
  ]);
  if (!data) notFound();
  const s = data as ServiceRow;
  const categories = [...new Set(((cats ?? []) as { categories: string[] }[]).flatMap((c) => c.categories ?? []))];

  return (
    <>
      <PageHeader eyebrow="Services" title={s.name} subtitle={<Link href="/admin/website/services" className="underline underline-offset-4">All services</Link>}
        actions={<><StatusBadge status={s.status} /><PreviewLink path={`/services#${s.slug}`} /></>} />
      <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
        <ServiceForm s={s} library={library} categories={categories} />
        <div className="space-y-6">
          <Panel title="Status">
            {s.status !== "archived"
              ? <ActionButton action={setServiceStatus} fields={{ serviceId, to: "archived" }} variant="outline" confirm={{ title: "Archive this service?", body: "It's hidden from the site and can be restored later.", label: "Archive" }}>Archive</ActionButton>
              : <ActionButton action={setServiceStatus} fields={{ serviceId, to: "draft" }} variant="outline">Restore as draft</ActionButton>}
          </Panel>
          <Panel title="Danger zone">
            <ActionButton action={deleteService} fields={{ serviceId }} variant="danger" className="h-9 px-3" confirm={{ title: `Delete “${s.name}”?`, body: "This can't be undone. Consider archiving instead.", label: "Delete service" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete service</ActionButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
