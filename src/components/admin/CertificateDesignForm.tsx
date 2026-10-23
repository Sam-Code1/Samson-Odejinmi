"use client";

import { saveCertificateDesign } from "@/app/admin/actions/settings";
import { AdminForm } from "./AdminForm";
import { TextInput } from "./FormFields";
import { ImageField, type LibraryImage } from "./ImageField";

export type CertificateDesign = { certificate_signatory_name: string; certificate_signatory_title: string; certificate_signature_url: string | null };

export function CertificateDesignForm({ d, library }: { d: CertificateDesign; library: LibraryImage[] }) {
  return (
    <AdminForm action={saveCertificateDesign} submitLabel="Save certificate design" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Signed by" name="certificate_signatory_name" required defaultValue={d.certificate_signatory_name} maxLength={80} />
        <TextInput label="Title" name="certificate_signatory_title" required defaultValue={d.certificate_signatory_title} maxLength={80} hint="Printed under the signature." />
        <ImageField name="signature" label="Signature image (optional)" current={d.certificate_signature_url} library={library}
          hint="A scan or photo of the signature, ideally a PNG with a transparent background. Without one, the name is set in italic." className="sm:col-span-2" />
      </div>
    </AdminForm>
  );
}
