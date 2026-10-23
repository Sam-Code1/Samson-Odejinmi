"use client";

import { cn } from "@/lib/utils";
import { useFieldError } from "./FormContext";
import { PasswordInput } from "@/components/forms/PasswordInput";

const control =
  "w-full min-w-0 rounded-lg border border-line-strong bg-elevated px-3 text-body-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink/40 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 disabled:opacity-60";

type Base = { label: string; name: string; hint?: string; className?: string };

function Wrap({ label, name, hint, className, required, children }: Base & { required?: boolean; children: React.ReactNode }) {
  const error = useFieldError(name);
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="mb-1.5 block text-caption font-semibold text-ink">
        {label}{required && <span aria-hidden className="text-warm"> *</span>}
      </label>
      {children}
      {error ? <p id={`f-${name}-e`} role="alert" className="mt-1.5 text-caption text-warm">{error}</p> : hint ? <p id={`f-${name}-h`} className="mt-1.5 text-caption text-ink-3">{hint}</p> : null}
    </div>
  );
}

const describe = (name: string, error?: string, hint?: string) => (error ? `f-${name}-e` : hint ? `f-${name}-h` : undefined);

export function TextInput({ label, name, hint, className, ...rest }: Base & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const error = useFieldError(name);
  return (
    <Wrap label={label} name={name} hint={hint} className={className} required={rest.required}>
      {rest.type === "password"
        ? <PasswordInput id={`f-${name}`} name={name} aria-invalid={!!error} aria-describedby={describe(name, error, hint)} inputClassName={cn(control, "h-11")} {...rest} />
        : <input id={`f-${name}`} name={name} aria-invalid={!!error} aria-describedby={describe(name, error, hint)} className={cn(control, "h-10")} {...rest} />}
    </Wrap>
  );
}

export function TextAreaInput({ label, name, hint, className, rows = 4, ...rest }: Base & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const error = useFieldError(name);
  return (
    <Wrap label={label} name={name} hint={hint} className={className} required={rest.required}>
      <textarea id={`f-${name}`} name={name} rows={rows} aria-invalid={!!error} aria-describedby={describe(name, error, hint)} className={cn(control, "resize-y py-2.5 leading-relaxed")} {...rest} />
    </Wrap>
  );
}

export function SelectInput({ label, name, hint, className, options, ...rest }: Base & { options: { value: string; label: string; disabled?: boolean }[] } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const error = useFieldError(name);
  return (
    <Wrap label={label} name={name} hint={hint} className={className} required={rest.required}>
      <select id={`f-${name}`} name={name} aria-invalid={!!error} aria-describedby={describe(name, error, hint)} className={cn(control, "h-10 bg-canvas")} {...rest}>
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}

export function FileInput({ label, name, hint, className, ...rest }: Base & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  const error = useFieldError(name);
  return (
    <Wrap label={label} name={name} hint={hint} className={className} required={rest.required}>
      <input id={`f-${name}`} name={name} type="file" aria-invalid={!!error} aria-describedby={describe(name, error, hint)}
        className={cn(control, "h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-caption file:font-semibold file:text-ink")} {...rest} />
    </Wrap>
  );
}

export function CheckboxInput({ label, name, hint, className, ...rest }: Base & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  const error = useFieldError(name);
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-3 text-body-sm">
        <input type="checkbox" name={name} className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-[rgb(var(--blue))]" {...rest} />
        <span><span className="font-medium text-ink">{label}</span>{hint && <span className="mt-0.5 block text-caption text-ink-3">{hint}</span>}</span>
      </label>
      {error && <p role="alert" className="mt-1.5 text-caption text-warm">{error}</p>}
    </div>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("ad-card min-w-0 p-5 sm:p-6", className)}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 border-b border-line pb-4">
        <h2 className="text-admin-section">{title}</h2>
        {description && <p className="mt-1 text-body-sm text-ink-3">{description}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 sm:[&>*:only-child]:col-span-2">{children}</div>
    </fieldset>
  );
}
