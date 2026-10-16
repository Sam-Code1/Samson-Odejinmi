import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { PageSections, PreviewLink } from "@/components/admin/PageSections";
import { AdminError } from "@/components/admin/AdminStates";
import { ContactSettingsForm, type ContactSettings } from "@/components/admin/WebsiteForms";
import { getAdminContext } from "@/lib/admin/guard";

export const metadata = { title: "Contact page" };

export default async function ContactAdmin() {
  const { supabase } = (await getAdminContext())!;
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  return (
    <>
      <PageHeader eyebrow="Website" title="Contact"
        subtitle={<>The contact page text and details. Messages sent through the form are in <Link href="/admin/website/messages" className="underline underline-offset-4">Messages</Link>.</>}
        actions={<PreviewLink path="/contact" />} />
      <div className="space-y-8">
        <Panel title="Contact details" description="Only share what you're comfortable making public.">
          {error || !data ? <AdminError body="Run supabase/migrations/0003_website_cms.sql, then refresh." /> : <ContactSettingsForm s={data as ContactSettings} />}
        </Panel>
        <section aria-label="Page text">
          <h2 className="mb-3 text-admin-section">Page text</h2>
          <PageSections page="contact" />
        </section>
      </div>
    </>
  );
}
