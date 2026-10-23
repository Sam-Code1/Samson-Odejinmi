import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { AvatarUpload } from "@/components/student/AvatarUpload";
import { changePassword } from "@/app/student-actions";
import { setMarketingConsent } from "@/app/marketing-actions";
import { StateForm } from "@/components/forms/StateForm";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl, initials } from "@/lib/avatar";

export const metadata: Metadata = { title: "Settings" };

function Panel({ id, title, body, children }: { id: string; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="fa-card p-5 sm:p-7">
      <h2 id={id} className="text-h4">{title}</h2>
      {body && <p className="mt-1 max-w-prose text-body-sm text-ink-2">{body}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const supabase = await createClient();
  const [{ data: contact, error: contactError }, profile] = await Promise.all([
    // Own contact row (RLS). Missing before migration 0008: the email preferences section is then hidden.
    supabase.from("contacts").select("marketing_consent, unsubscribed_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("first_name, last_name, avatar_path").eq("id", user.id).maybeSingle(),
  ]);
  const avatarsReady = !profile.error; // before migration 0015 the avatar_path column doesn't exist
  const p = profile.data as { first_name?: string; last_name?: string; avatar_path?: string | null } | null;
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="fa-label">Settings</p>
        <h1 className="mt-3 text-h2">Settings</h1>
      </header>
      <Panel id="photo" title="Profile photo" body="Shown in your student portal and next to reviews you write.">
        {avatarsReady
          ? <AvatarUpload current={avatarUrl(p?.avatar_path)} initials={initials(p?.first_name, p?.last_name, user.email)} />
          : <p className="text-body-sm text-ink-2">Profile photos will be available shortly.</p>}
      </Panel>
      <Panel id="theme" title="Appearance" body="Night is the Academy's home; Paper is designed for reading in daylight. System follows your device.">
        <ThemeSwitcher inline className="max-w-sm" />
      </Panel>
      {!contactError && (
        <Panel id="email-prefs" title="Email preferences" body="Emails about your purchases, courses and account always arrive. This only controls marketing emails.">
          <StateForm action={setMarketingConsent} submitLabel="Save preferences" variant="secondary">
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-body-sm">
              <input type="checkbox" name="marketing" defaultChecked={!!contact?.marketing_consent && !contact?.unsubscribed_at} className="mt-1 h-4 w-4 accent-[rgb(var(--action))]" />
              <span>Email me about new courses, books and offers.</span>
            </label>
          </StateForm>
        </Panel>
      )}
      <Panel id="pw" title="Change password">
        <ActionForm action={changePassword} submitLabel="Update password">
          <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." required />
          <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
        </ActionForm>
      </Panel>
    </div>
  );
}
