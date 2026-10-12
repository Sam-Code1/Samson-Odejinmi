"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "./Field";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/app/auth-actions";

type Mode = "login" | "register" | "forgot" | "reset";
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const copy: Record<Mode, { cta: string }> = {
  login: { cta: "Log in" },
  register: { cta: "Create account" },
  forgot: { cta: "Send reset link" },
  reset: { cta: "Update password" },
};

export function AuthForm({ mode, action, next }: { mode: Mode; action: Action; next?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const f = state.fields ?? {};

  return (
    <form action={formAction} noValidate className="space-y-6">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="First name" name="first_name" autoComplete="given-name" defaultValue={f.first_name} required />
          <Field label="Last name" name="last_name" autoComplete="family-name" defaultValue={f.last_name} required />
        </div>
      )}
      {mode !== "reset" && <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={f.email} required />}
      {(mode === "login" || mode === "register" || mode === "reset") && (
        <Field label={mode === "reset" ? "New password" : "Password"} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} hint={mode !== "login" ? "At least 8 characters." : undefined} required />
      )}
      {(mode === "register" || mode === "reset") && <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />}

      {state.error && <p role="alert" className="border-l-2 border-blue pl-4 text-body-sm">{state.error}</p>}
      {state.message && <p role="status" className="border-l-2 border-violet pl-4 text-body-sm text-ink-2">{state.message}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "One moment…" : copy[mode].cta}</Button>

      <div className="space-y-2 text-body-sm text-ink-2">
        {mode === "login" && (<>
          <p><Link href="/forgot-password" className="underline underline-offset-4 hover:text-ink">Forgot your password?</Link></p>
          <p>New here? <Link href="/register" className="underline underline-offset-4 hover:text-ink">Create an account</Link></p>
        </>)}
        {mode === "register" && <p>Already have an account? <Link href="/login" className="underline underline-offset-4 hover:text-ink">Log in</Link></p>}
        {mode === "forgot" && <p><Link href="/login" className="underline underline-offset-4 hover:text-ink">Back to log in</Link></p>}
      </div>
    </form>
  );
}
