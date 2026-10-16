"use client";

import { saveAffiliate } from "@/app/admin/actions/affiliates";
import { AdminForm } from "./AdminForm";
import { FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";

export function AffiliateForm({ a }: { a: { id: string; status: string; commission_rate_bps: number; notes: string | null } }) {
  return (
    <AdminForm action={saveAffiliate} submitLabel="Save affiliate" stickyBar={false}>
      <input type="hidden" name="affiliateId" value={a.id} />
      <FormSection title="Review" description="Only active affiliates are credited. Rate changes apply to future sales; past commissions keep the rate they were earned at.">
        <SelectInput label="Status" name="status" defaultValue={a.status} options={[{ value: "pending", label: "Pending review" }, { value: "active", label: "Active (approved)" }, { value: "suspended", label: "Suspended" }, { value: "rejected", label: "Rejected" }]} />
        <TextInput label="Commission (%)" name="rate" inputMode="decimal" defaultValue={String(a.commission_rate_bps / 100)} hint="Of the amount actually paid, after discounts." />
        <TextAreaInput label="Internal notes" name="notes" rows={3} defaultValue={a.notes ?? ""} maxLength={2000} className="sm:col-span-2" />
      </FormSection>
    </AdminForm>
  );
}
