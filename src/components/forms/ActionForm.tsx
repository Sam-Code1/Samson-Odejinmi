"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/app/auth-actions";

export function ActionForm({ action, submitLabel, children }: { action: (prev: FormState, fd: FormData) => Promise<FormState>; submitLabel: string; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} noValidate className="space-y-6">
      {children}
      {state.error && <p role="alert" className="border-l-2 border-blue pl-4 text-body-sm">{state.error}</p>}
      {state.message && <p role="status" className="border-l-2 border-violet pl-4 text-body-sm text-ink-2">{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
