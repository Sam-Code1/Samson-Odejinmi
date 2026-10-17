"use client";

import { cn } from "@/lib/utils";

export type ProviderChoice = { id: string; name: string; methods: string[] };

/**
 * "Pay with": only the providers the server says can take this currency for this buyer right now. One provider is
 * selected automatically. The server re-checks the choice and may route to another capable provider; the browser can't
 * add a provider that isn't on the list.
 */
export function PaymentPicker({ providers, value, onChange }: { providers: ProviderChoice[]; value: string; onChange: (id: string) => void }) {
  if (!providers.length) return null;
  if (providers.length === 1) {
    const p = providers[0];
    return (
      <div className="text-caption text-ink-3">
        <input type="hidden" name="provider" value={p.id} />
        Pay with <span className="text-ink-2">{p.name}</span>{p.methods.length ? ` · ${p.methods.join(", ")}` : ""}
      </div>
    );
  }
  return (
    <fieldset>
      <legend className="mb-2 text-caption text-ink-3">Pay with</legend>
      <input type="hidden" name="provider" value={value} />
      <div role="radiogroup" aria-label="Payment provider" className="space-y-2">
        {providers.map((p) => {
          const on = p.id === value;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(p.id)}
              className={cn("flex min-h-[44px] w-full items-center gap-3 rounded border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40",
                on ? "border-ink bg-ink/5" : "border-line-strong hover:border-ink")}>
              <span aria-hidden className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", on ? "border-ink" : "border-line-strong")}>{on && <span className="h-2 w-2 rounded-full bg-ink" />}</span>
              <span className="min-w-0">
                <span className="block text-label">{p.name}</span>
                {p.methods.length > 0 && <span className="block truncate text-caption text-ink-3">{p.methods.join(", ")}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
