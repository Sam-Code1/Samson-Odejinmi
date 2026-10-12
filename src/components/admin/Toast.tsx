"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error";
type ToastItem = { id: number; kind: Kind; text: string };
type Push = (kind: Kind, text: string) => void;

const ToastContext = createContext<Push>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback<Push>((kind, text) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p.slice(-3), { id, kind, text }]);
  }, []);
  const dismiss = (id: number) => setItems((p) => p.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => <ToastCard key={t.id} item={t} onDone={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, item.kind === "error" ? 7000 : 3800);
    return () => window.clearTimeout(id);
  }, [item, onDone]);
  const Icon = item.kind === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div role={item.kind === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-elevated p-3.5 text-body-sm shadow-[0_12px_32px_-12px_rgb(var(--ink)/0.35)]", "border-l-2", item.kind === "success" ? "border-l-blue" : "border-l-warm")}>
      <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", item.kind === "success" ? "text-blue" : "text-warm")} strokeWidth={1.75} />
      <p className="flex-1 text-ink">{item.text}</p>
      <button type="button" onClick={onDone} aria-label="Dismiss" className="-m-1 rounded p-1 text-ink-3 hover:text-ink"><X className="h-4 w-4" strokeWidth={1.75} /></button>
    </div>
  );
}
