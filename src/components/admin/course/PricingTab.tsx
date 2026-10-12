import { savePricing } from "@/app/admin/actions/courses";
import { AdminForm } from "../AdminForm";
import { CheckboxInput, FormSection, TextInput } from "../FormFields";

const CURRENCIES = [{ code: "NGN", label: "Nigerian naira (₦)" }, { code: "USD", label: "US dollar ($)" }, { code: "GBP", label: "British pound (£)" }];

export function PricingTab({ courseId, prices }: { courseId: string; prices: { currency: string; amount_minor: number; active: boolean }[] }) {
  return (
    <AdminForm action={savePricing} submitLabel="Save pricing">
      <input type="hidden" name="id" value={courseId} />
      <FormSection title="Prices" description="One-time payment, lifetime access. Leave a price empty to not offer that currency. Visitors in Nigeria see naira by default; everyone else sees dollars, and can switch.">
        {CURRENCIES.map((c) => {
          const row = prices.find((p) => p.currency === c.code);
          return (
            <div key={c.code} className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <TextInput label={c.label} name={`price_${c.code}`} inputMode="decimal" defaultValue={row ? String(row.amount_minor / 100) : ""} placeholder="e.g. 25000" />
              <CheckboxInput label="Active" name={`active_${c.code}`} defaultChecked={row?.active ?? true} className="pb-2" />
            </div>
          );
        })}
      </FormSection>
    </AdminForm>
  );
}
