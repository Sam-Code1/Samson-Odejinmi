"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

type State = { ok?: boolean; message?: string; error?: string };

/** Small public/student form bound to a server action that returns { ok, message, error }. */
export function StateForm({ action, submitLabel, children, hideOnSuccess = false, variant = "primary" }: {
  action: (prev: State, fd: FormData) => Promise<State>; submitLabel: string; children?: React.ReactNode; hideOnSuccess?: boolean; variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (hideOnSuccess && state.ok) return <p role="status" className="border-l-2 border-violet pl-4 text-body-sm text-ink-2">{state.message}</p>;
  return (
    <form action={formAction} noValidate className="space-y-5">
      {children}
      {state.error && <p role="alert" className="border-l-2 border-warm pl-4 text-body-sm">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="border-l-2 border-violet pl-4 text-body-sm text-ink-2">{state.message}</p>}
      <Button type="submit" variant={variant} disabled={pending}>{pending ? "One moment…" : submitLabel}</Button>
    </form>
  );
}
