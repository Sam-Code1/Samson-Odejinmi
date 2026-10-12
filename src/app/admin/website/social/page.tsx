import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminEmpty, AdminError } from "@/components/admin/AdminStates";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SocialLinkForm, type SocialRow } from "@/components/admin/WebsiteForms";
import { deleteSocialLink, moveSocialLink } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";

export const metadata = { title: "Social links" };

export default async function SocialAdmin() {
  const { supabase } = (await getAdminContext())!;
  const { data, error } = await supabase.from("social_links").select("id, platform, label, url, active").order("display_order").order("created_at");
  const rows = (data ?? []) as SocialRow[];

  return (
    <>
      <PageHeader eyebrow="Website" title="Social links" subtitle="Shown in the footer, on the About page and on the Contact page. Only add profiles that are real and yours." />
      {error ? <AdminError title="Unable to load social links" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : (
        <div className="space-y-6">
          <Panel title="Add a link"><SocialLinkForm /></Panel>
          {rows.length === 0 ? <AdminEmpty title="No social links yet" body="Nothing is shown on the site until you add one." /> : (
            <ul className="space-y-3">
              {rows.map((l, i) => (
                <li key={l.id} className="rounded-lg border border-line bg-elevated p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-body-sm font-semibold">{l.label}<StatusBadge status={l.active ? "active" : "draft"} /></span>
                    <div className="flex items-center gap-1">
                      <ActionButton action={moveSocialLink} fields={{ linkId: l.id, dir: "up" }} ariaLabel={`Move ${l.label} up`} disabled={i === 0}><ArrowUp aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton action={moveSocialLink} fields={{ linkId: l.id, dir: "down" }} ariaLabel={`Move ${l.label} down`} disabled={i === rows.length - 1}><ArrowDown aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton action={deleteSocialLink} fields={{ linkId: l.id }} variant="danger" ariaLabel={`Delete ${l.label}`} confirm={{ title: `Remove ${l.label}?`, body: "It disappears from the site.", label: "Remove" }}><Trash2 aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                    </div>
                  </div>
                  <SocialLinkForm link={l} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
