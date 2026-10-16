"use client";

import { useState } from "react";
import { saveCoupon } from "@/app/admin/actions/coupons";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import { useFieldError } from "./FormContext";

export type CouponRow = {
  id: string; code: string; description: string | null; discount_type: "percentage" | "fixed_amount"; discount_value: number; currency: string | null;
  active: boolean; starts_at: string | null; expires_at: string | null; usage_limit: number | null; per_user_limit: number | null;
  min_amount_minor: number | null; applies_to_all: boolean; campaign_id?: string | null;
};
type Opt = { id: string; name: string };

const local = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function CoursesError() {
  const e = useFieldError("course_ids");
  return e ? <p role="alert" className="text-caption text-warm">{e}</p> : null;
}

/** `products` / `campaigns` are passed once migration 0008 exists; without them those sections are hidden. */
export function CouponForm({ coupon, courses, selected, products, selectedProducts = [], campaigns }: {
  coupon?: CouponRow; courses: { id: string; title: string }[]; selected: string[]; products?: Opt[]; selectedProducts?: string[]; campaigns?: Opt[];
}) {
  const [type, setType] = useState<string>(coupon?.discount_type ?? "percentage");
  const [applies, setApplies] = useState<string>(coupon && !coupon.applies_to_all ? "selected" : "all");
  return (
    <AdminForm action={saveCoupon} submitLabel={coupon ? "Save coupon" : "Create coupon"}>
      {coupon && <input type="hidden" name="couponId" value={coupon.id} />}
      <FormSection title="Coupon">
        <TextInput label="Code" name="code" required defaultValue={coupon?.code ?? ""} maxLength={32} autoComplete="off" hint="What students type at checkout. Saved in capitals." />
        <CheckboxInput label="Active" name="active" defaultChecked={coupon?.active ?? true} hint="Inactive coupons are rejected at checkout." className="self-end pb-2" />
        <TextAreaInput label="Description (internal)" name="description" rows={2} defaultValue={coupon?.description ?? ""} maxLength={300} className="sm:col-span-2" hint="e.g. which campaign it's for." />
        {campaigns && (
          <SelectInput label="Marketing campaign (optional)" name="campaign_id" defaultValue={coupon?.campaign_id ?? ""} hint="Sales with this code count towards the campaign's results."
            options={[{ value: "", label: "None" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]} />
        )}
      </FormSection>
      <FormSection title="Discount" description="Totals can never go below zero. A 100% coupon enrols the student without payment.">
        <SelectInput label="Type" name="discount_type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "percentage", label: "Percentage off" }, { value: "fixed_amount", label: "Fixed amount off" }]} />
        <TextInput label={type === "percentage" ? "Percentage (1–100)" : "Amount off"} name="discount_value" inputMode="decimal" required
          defaultValue={coupon ? (coupon.discount_type === "percentage" ? String(coupon.discount_value) : String(coupon.discount_value / 100)) : ""} />
        <SelectInput label="Currency" name="currency" defaultValue={coupon?.currency ?? ""} hint={type === "fixed_amount" ? "Required for a fixed amount. It then only works in this currency." : "Optional. Leave as “Any” for every currency."}
          options={[{ value: "", label: "Any currency" }, { value: "NGN", label: "NGN (₦)" }, { value: "USD", label: "USD ($)" }, { value: "GBP", label: "GBP (£)" }]} />
        <TextInput label="Minimum purchase (optional)" name="min_amount" inputMode="decimal" defaultValue={coupon?.min_amount_minor ? String(coupon.min_amount_minor / 100) : ""} hint="In the coupon's currency." />
      </FormSection>
      <FormSection title="Limits and dates">
        <TextInput label="Starts (UTC, optional)" name="starts_at" type="datetime-local" defaultValue={local(coupon?.starts_at ?? null)} />
        <TextInput label="Expires (UTC, optional)" name="expires_at" type="datetime-local" defaultValue={local(coupon?.expires_at ?? null)} />
        <TextInput label="Total uses (optional)" name="usage_limit" type="number" min={1} defaultValue={coupon?.usage_limit ? String(coupon.usage_limit) : ""} hint="Leave empty for unlimited." />
        <TextInput label="Uses per student" name="per_user_limit" type="number" min={1} defaultValue={coupon ? (coupon.per_user_limit ? String(coupon.per_user_limit) : "") : "1"} hint="Leave empty for unlimited." />
      </FormSection>
      <FormSection title="Applies to">
        <SelectInput label="Where it works" name="applies" value={applies} onChange={(e) => setApplies(e.target.value)} options={[{ value: "all", label: products ? "Everything (all courses and products)" : "All courses" }, { value: "selected", label: products ? "Selected courses and products only" : "Selected courses only" }]} />
        {products && <input type="hidden" name="product_ids_present" value="1" />}
        {applies === "selected" && (
          <div className="space-y-4 sm:col-span-2">
            <p className="text-caption font-semibold text-ink-3">Courses</p>
            {courses.length === 0 ? <p className="text-body-sm text-ink-3">No courses yet.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {courses.map((c) => (
                  <li key={c.id}><label className="flex items-center gap-2 text-body-sm"><input type="checkbox" name="course_ids" value={c.id} defaultChecked={selected.includes(c.id)} className="h-4 w-4 accent-[rgb(var(--blue))]" />{c.title}</label></li>
                ))}
              </ul>
            )}
            {products && (
              <>
                <p className="text-caption font-semibold text-ink-3">Products (ebooks, guides, bundles…)</p>
                {products.length === 0 ? <p className="text-body-sm text-ink-3">No products yet.</p> : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {products.map((p) => (
                      <li key={p.id}><label className="flex min-h-[44px] items-center gap-2 text-body-sm sm:min-h-0"><input type="checkbox" name="product_ids" value={p.id} defaultChecked={selectedProducts.includes(p.id)} className="h-4 w-4 accent-[rgb(var(--blue))]" />{p.name}</label></li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <CoursesError />
          </div>
        )}
      </FormSection>
    </AdminForm>
  );
}
