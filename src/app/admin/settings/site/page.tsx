import { PageHeader } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { SiteSettingsForm, type SiteSettingsRow } from "@/components/admin/WebsiteForms";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";

export const metadata = { title: "Site settings" };

export default async function SiteSettingsPage() {
  const ctx = (await getAdminContext())!;
  const [{ data, error }, library] = await Promise.all([ctx.supabase.from("site_settings").select("*").eq("id", true).maybeSingle(), getLibraryImages(ctx)]);
  return (
    <>
      <PageHeader eyebrow="System" title="Site settings" subtitle="Name, branding, contact, footer and search defaults for the main website. API keys and secrets are never shown or stored here." />
      {error || !data ? <AdminError title="Unable to load site settings" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : <SiteSettingsForm s={data as SiteSettingsRow} library={library} />}
    </>
  );
}
