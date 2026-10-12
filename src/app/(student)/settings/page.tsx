import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { changePassword } from "@/app/student-actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser("/settings");
  return (
    <div className="max-w-xl space-y-16">
      <h1 className="text-h1">Settings</h1>
      <section aria-labelledby="theme">
        <h2 id="theme" className="text-h3">Appearance</h2>
        <p className="mt-2 text-body-sm text-ink-2">System follows your device. Your choice is remembered on this browser.</p>
        <ThemeSwitcher inline className="mt-5 max-w-sm" />
      </section>
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
