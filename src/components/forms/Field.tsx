import { cn } from "@/lib/utils";
import { PasswordInput } from "./PasswordInput";

type Common = { label: string; name: string; hint?: string; error?: string; className?: string };

const control =
  "w-full rounded border border-line-strong bg-transparent px-4 text-body text-ink placeholder:text-ink-3 transition-colors duration-quick hover:border-ink/50 focus:border-blue-soft focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-blue/30";

export function Field({ label, name, hint, error, className, ...rest }: Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-label text-ink">{label}</label>
      {rest.type === "password"
        ? <PasswordInput id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} inputClassName={cn(control, "h-12")} {...rest} />
        : <input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} className={cn(control, "h-12")} {...rest} />}
      {hint && !error && <p id={`${id}-h`} className="mt-2 text-caption text-ink-3">{hint}</p>}
      {error && <p id={`${id}-e`} className="mt-2 text-caption text-[rgb(var(--blue-soft))]" role="alert">{error}</p>}
    </div>
  );
}

export function TextArea({ label, name, hint, error, className, ...rest }: Common & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-label text-ink">{label}</label>
      <textarea id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} className={cn(control, "min-h-40 resize-y py-3")} {...rest} />
      {hint && !error && <p id={`${id}-h`} className="mt-2 text-caption text-ink-3">{hint}</p>}
      {error && <p id={`${id}-e`} className="mt-2 text-caption text-[rgb(var(--blue-soft))]" role="alert">{error}</p>}
    </div>
  );
}

export function Select({ label, name, options, className, defaultValue }: { label: string; name: string; options: string[]; className?: string; defaultValue?: string }) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-label text-ink">{label}</label>
      <div className="relative">
        <select id={id} name={name} defaultValue={defaultValue ?? ""} className={cn(control, "h-12 appearance-none bg-canvas pr-10")}>
          <option value="">Not sure yet</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 8 5 5 5-5" /></svg>
      </div>
    </div>
  );
}
