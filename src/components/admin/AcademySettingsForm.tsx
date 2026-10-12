import { saveAcademySettings } from "@/app/admin/actions/settings";
import { AdminForm } from "./AdminForm";
import { FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";

export type Settings = { academy_name: string; description: string | null; support_email: string | null; default_currency: string; timezone: string; default_video_provider: string };

export function AcademySettingsForm({ s }: { s: Settings }) {
  return (
    <AdminForm action={saveAcademySettings} submitLabel="Save settings">
      <FormSection title="Academy" description="General details about your Academy.">
        <TextInput label="Academy name" name="academy_name" required defaultValue={s.academy_name} />
        <TextInput label="Support email" name="support_email" type="email" defaultValue={s.support_email ?? ""} />
        <TextAreaInput label="Description" name="description" rows={2} defaultValue={s.description ?? ""} className="sm:col-span-2" />
        <SelectInput label="Default currency" name="default_currency" defaultValue={s.default_currency} options={[{ value: "NGN", label: "NGN (₦)" }, { value: "USD", label: "USD ($)" }, { value: "GBP", label: "GBP (£)" }]} />
        <TextInput label="Timezone" name="timezone" defaultValue={s.timezone} hint="For example Africa/Lagos or Europe/London." />
      </FormSection>
      <FormSection title="Video" description="Only YouTube is connected today. The student player is provider-independent, so switching later doesn't change lessons.">
        <SelectInput label="Default video provider" name="default_video_provider" defaultValue={s.default_video_provider} options={[{ value: "youtube", label: "YouTube (current)" }, { value: "bunny", label: "Bunny Stream (not connected)", disabled: true }, { value: "mux", label: "Mux (not connected)", disabled: true }, { value: "cloudflare", label: "Cloudflare Stream (not connected)", disabled: true }]} />
      </FormSection>
    </AdminForm>
  );
}
