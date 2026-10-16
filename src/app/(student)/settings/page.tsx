import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { changePassword } from "@/app/student-actions";
import { setMarketingConsent } from "@/app/marketing-actions";
import { StateForm } from "@/components/forms/StateForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const supabase = await createClient();
  // Own contact row (RLS). Missing before migration 0008: the email preferences section is then hidden.
  const { data: contact, error: contactError } = await supabase.from("contacts").select("marketing_consent, unsubscribed_at").eq("user_id", user.id).maybeSingle();
  return (
    <div className="max-w-xl space-y-16">
      <h1 className="text-h1">Settings</h1>
      <section aria-labelledby="theme">
        <h2 id="theme" className="text-h3">Appearance</h2>
        <p className="mt-2 text-body-sm text-ink-2">System follows your device. Your choice is remembered on this browser.</p>
        <ThemeSwitcher inline className="mt-5 max-w-sm" />
      </section>
      {!contactError && (
        <section aria-labelledby="email-prefs">
          <h2 id="email-prefs" className="text-h3">Email preferences</h2>
          <p className="mt-2 text-body-sm text-ink-2">Emails about your purchases, courses and account always arrive. This only controls marketing emails.</p>
          <div className="mt-6">
            <StateForm action={setMarketingConsent} submitLabel="Save preferences" variant="secondary">
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-body-sm">
                <input type="checkbox" name="marketing" defaultChecked={!!contact?.marketing_consent && !contact?.unsubscribed_at} className="mt-1 h-4 w-4 accent-[rgb(var(--blue))]" />
                <span>Email me about new courses, guides and offers.</span>
              </label>
            </StateForm>
          </div>
        </section>
      )}
      <section aria-labelledby="pw">
        <h2 id="pw" className="text-h3">Change password</h2>
        <div className="mt-6">
          <ActionForm action={changePassword} submitLabel="Update password">
            <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." required />
            <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
