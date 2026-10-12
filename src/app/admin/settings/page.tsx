import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { AcademySettingsForm, type Settings } from "@/components/admin/AcademySettingsForm";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { updateProfile } from "@/app/student-actions";
import { getAdminContext } from "@/lib/admin/guard";
import { personName } from "@/lib/admin/format";
import { aiStatus } from "@/lib/ai/provider";
import { payableCurrencies, paystackMode } from "@/lib/payments/paystack";
import { site } from "@/lib/site";
import Link from "next/link";

export const metadata = { title: "Academy settings" };

/** Only reports whether a secret exists. Secret values are never read into the page. */
const configured = (v: string | undefined) => <StatusBadge status={v ? "configured" : "not_set"} />;

export default async function SettingsPage() {
  const { supabase, user } = (await getAdminContext())!;
  const [s, me, admins] = await Promise.all([
    supabase.from("academy_settings").select("academy_name, description, support_email, default_currency, timezone, default_video_provider").eq("id", true).maybeSingle(),
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.from("admin_users").select("user_id, profiles(first_name, last_name, email)"),
  ]);
  const adminRows = (admins.data ?? []) as unknown as { user_id: string; profiles: { first_name: string; last_name: string; email: string | null } | null }[];

  return (
    <>
      <PageHeader eyebrow="System" title="Academy settings" subtitle={<>Academy details, your profile and the status of connected services. Website name, branding and footer are in <Link href="/admin/settings/site" className="underline underline-offset-4">Site settings</Link>.</>} />
      <div className="space-y-8">
        <section id="academy" aria-label="Academy and video">
          {s.error || !s.data ? <AdminError body="Settings need migration 0002. Run supabase/migrations/0002_admin_cms.sql, then refresh." /> : <AcademySettingsForm s={s.data as Settings} />}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Profile" description="Your own name, as shown on certificates you issue and in the Academy.">
            <ActionForm action={updateProfile} submitLabel="Save profile">
              <div className="grid gap-5 sm:grid-cols-2"><Field label="First name" name="first_name" defaultValue={me.data?.first_name ?? ""} /><Field label="Last name" name="last_name" defaultValue={me.data?.last_name ?? ""} /></div>
            </ActionForm>
          </Panel>

          <Panel title="Brand" description="The Academy shares the site's design system.">
            <p className="mb-3 text-body-sm text-ink-2">Theme for this device</p>
            <ThemeSwitcher inline className="max-w-sm" />
            <p className="mt-4 text-caption text-ink-3">Typeface: Manrope. Light, dark and system themes are shared with the whole site.</p>
          </Panel>

          <Panel title="Email" description="Where the contact form is delivered.">
            <ul className="space-y-2 text-body-sm">
              <li className="flex items-center justify-between gap-3"><span>Contact form delivery (Resend)</span>{configured(process.env.RESEND_API_KEY)}</li>
              <li className="flex items-center justify-between gap-3"><span>Delivered to</span><span className="text-ink-2">{process.env.CONTACT_TO_EMAIL ?? process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "Not set"}</span></li>
            </ul>
            <p className="mt-3 text-caption text-ink-3">Set in environment variables, not here.</p>
          </Panel>

          <Panel title="Payments" description="Paystack. Keys stay in server environment variables, never in the database or the browser.">
            <ul className="space-y-2 text-body-sm">
              <li className="flex items-center justify-between gap-3"><span>PAYSTACK_SECRET_KEY</span>{configured(process.env.PAYSTACK_SECRET_KEY)}</li>
              <li className="flex items-center justify-between gap-3"><span>Mode</span><span className="text-ink-2">{paystackMode() ?? "–"}</span></li>
              <li className="flex items-center justify-between gap-3"><span>Currencies accepted</span><span className="text-ink-2">{payableCurrencies().join(", ")}</span></li>
              <li className="flex items-center justify-between gap-3"><span>SUPABASE_SERVICE_ROLE_KEY (needed to confirm payments)</span>{configured(process.env.SUPABASE_SERVICE_ROLE_KEY)}</li>
            </ul>
            <p className="mt-3 text-caption text-ink-3">Webhook URL for Paystack: <code className="rounded bg-surface px-1.5 py-0.5">{site.url}/api/webhooks/paystack</code>. Test in test mode (sk_test_…) before switching to live keys.</p>
          </Panel>

          <Panel title="Transactional email" description="Purchase, enrolment, certificate and welcome emails.">
            <ul className="space-y-2 text-body-sm">
              <li className="flex items-center justify-between gap-3"><span>RESEND_API_KEY</span>{configured(process.env.RESEND_API_KEY)}</li>
              <li className="flex items-center justify-between gap-3"><span>Sender</span><span className="text-ink-2">{process.env.EMAIL_FROM ?? process.env.CONTACT_FROM_EMAIL ?? "Not set"}</span></li>
            </ul>
            <p className="mt-3 text-caption text-ink-3">Without a key these emails are skipped (never faked). Verification and password-reset emails come from Supabase Auth: set its SMTP to the same provider.</p>
          </Panel>

          <Panel title="AI" description="Used by the quiz generator and content assistant. The key stays in server environment variables.">
            {(() => { const ai = aiStatus(); return (
              <ul className="space-y-2 text-body-sm">
                <li className="flex items-center justify-between gap-3"><span>Provider</span><span className="text-ink-2">{ai.provider}</span></li>
                <li className="flex items-center justify-between gap-3"><span>Model</span><span className="text-ink-2">{ai.model ?? "–"}</span></li>
                <li className="flex items-center justify-between gap-3"><span>{ai.envVar}</span>{configured(ai.configured ? "yes" : undefined)}</li>
              </ul>
            ); })()}
            <p className="mt-3 text-caption text-ink-3">AI output is always a draft. Questions are never published without your approval. Limit: 30 AI requests per admin per hour.</p>
          </Panel>

          <Panel title="Security" className="lg:col-span-2" description="Admin access is decided in the database, not in the browser.">
            <p className="mb-3 text-body-sm text-ink-2">Administrators</p>
            <ul className="space-y-1 text-body-sm">{adminRows.map((a) => <li key={a.user_id} className="flex justify-between gap-3"><span>{personName(a.profiles)}</span><span className="text-ink-3">{a.profiles?.email}</span></li>)}</ul>
            <p className="mt-4 text-caption text-ink-3">To add or remove an admin, edit the admin_users table in Supabase. Course files are private and served through short-lived links. Lesson videos are view-only, with no download or share controls.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
