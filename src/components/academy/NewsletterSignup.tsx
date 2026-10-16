"use client";

import { useActionState } from "react";
import { subscribeNewsletter, type FormState } from "@/app/marketing-actions";
import { Button } from "@/components/ui/Button";

/** Email sign-up with an explicit, unticked consent box. Hidden "company" field catches bots. */
export function NewsletterSignup({ title = "Get new courses and guides first", body = "Occasional emails when something new is ready. No spam; unsubscribe with one click." }: { title?: string; body?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeNewsletter, {});
  if (state.ok) return <p role="status" className="rounded-lg border border-line bg-elevated p-5 text-body-sm text-ink-2">{state.message}</p>;
  return (
    <form action={action} noValidate className="relative overflow-hidden rounded-xl border border-line bg-elevated p-5 sm:p-7">
      <h2 className="text-h4">{title}</h2>
      <p className="mt-2 text-body-sm text-ink-2">{body}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <label className="sr-only" htmlFor="nl-name">First name</label>
        <input id="nl-name" name="first_name" autoComplete="given-name" placeholder="First name (optional)" maxLength={80}
          className="h-11 min-w-0 rounded border border-line-strong bg-transparent px-3 text-base placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm" />
        <label className="sr-only" htmlFor="nl-email">Email</label>
        <input id="nl-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" maxLength={254}
          className="h-11 min-w-0 rounded border border-line-strong bg-transparent px-3 text-base placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm" />
      </div>
      <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label>Company <input name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="mt-4 flex min-h-[44px] cursor-pointer items-start gap-3 text-body-sm text-ink-2">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--blue))]" />
        <span>Yes, email me about new courses, guides and offers from Fola Academy.</span>
      </label>
      {state.error && <p role="alert" className="mt-3 text-caption text-warm">{state.error}</p>}
      <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={pending}>{pending ? "Subscribing…" : "Subscribe"}</Button>
    </form>
  );
}
