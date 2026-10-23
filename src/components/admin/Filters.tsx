"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
}

export function SearchInput({ placeholder = "Search", param = "q" }: { placeholder?: string; param?: string }) {
  const sp = useSearchParams();
  const set = useParamSetter();
  const [value, setValue] = useState(sp.get(param) ?? "");
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <div className="relative w-full sm:w-72">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.5} />
      <input
        type="search" value={value} aria-label={placeholder} placeholder={placeholder}
        onChange={(e) => { setValue(e.target.value); window.clearTimeout(t.current); t.current = window.setTimeout(() => set(param, e.target.value.trim()), 350); }}
        className="h-10 w-full rounded-lg border border-line-strong bg-elevated pl-9 pr-3 text-body-sm placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30"
      />
    </div>
  );
}

export function FilterSelect({ param, label, options }: { param: string; label: string; options: { value: string; label: string }[] }) {
  const sp = useSearchParams();
  const set = useParamSetter();
  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-2">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select value={sp.get(param) ?? ""} onChange={(e) => set(param, e.target.value)} className="h-10 max-w-full rounded-lg border border-line-strong bg-elevated px-3 text-body-sm text-ink focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30">
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
