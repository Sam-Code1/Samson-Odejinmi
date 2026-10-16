"use client";

import { savePaymentProvider } from "@/app/admin/actions/payment-settings";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FormSection, TextInput } from "./FormFields";
import { useFieldError } from "./FormContext";

type Props = {
  id: string; name: string; enabled: boolean; priority: number; currencies: string[]; methods: string[];
  supportedCurrencies: string[]; supportedMethods: { id: string; label: string }[]; disabledReason?: string;
};

function EnabledError() {
  const e = useFieldError("enabled");
  return e ? <p role="alert" className="text-caption text-warm sm:col-span-2">{e}</p> : null;
}

export function PaymentProviderForm(p: Props) {
  return (
    <AdminForm action={savePaymentProvider} submitLabel={`Save ${p.name}`} stickyBar={false}>
      <input type="hidden" name="providerId" value={p.id} />
      <FormSection title="Checkout settings" description={p.disabledReason}>
        <CheckboxInput label={`Offer ${p.name} at checkout`} name="enabled" defaultChecked={p.enabled} disabled={!!p.disabledReason} />
        <TextInput label="Priority" name="priority" type="number" min={0} max={1000} defaultValue={String(p.priority)} hint="Lower first. When two providers offer the same method, the lower number is used." />
        <EnabledError />
        {p.supportedCurrencies.length > 0 && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-caption font-semibold">Currencies</legend>
            <div className="flex flex-wrap gap-2">{p.supportedCurrencies.map((c) => (
              <label key={c} className="flex min-h-[40px] items-center gap-2 rounded border border-line px-3 text-body-sm"><input type="checkbox" name="currencies" value={c} defaultChecked={p.currencies.includes(c)} className="h-4 w-4 accent-[rgb(var(--blue))]" />{c}</label>
            ))}</div>
            <p className="mt-1.5 text-caption text-ink-3">Only tick currencies enabled on your {p.name} account.</p>
          </fieldset>
        )}
        {p.supportedMethods.length > 0 && (
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-caption font-semibold">Payment methods</legend>
            <div className="flex flex-wrap gap-2">{p.supportedMethods.map((m) => (
              <label key={m.id} className="flex min-h-[40px] items-center gap-2 rounded border border-line px-3 text-body-sm"><input type="checkbox" name="methods" value={m.id} defaultChecked={p.methods.includes(m.id)} className="h-4 w-4 accent-[rgb(var(--blue))]" />{m.label}</label>
            ))}</div>
            <p className="mt-1.5 text-caption text-ink-3">Only tick methods activated on your {p.name} account (some, like OPay or QR, need activation). Local Nigerian methods are shown only to buyers in Nigeria.</p>
          </fieldset>
        )}
      </FormSection>
    </AdminForm>
  );
}
