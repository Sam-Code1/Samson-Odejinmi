"use client";

import { startTransition, useActionState } from "react";
import { sendContact, type ContactState } from "@/app/contact-action";
import { Field, Select, TextArea } from "./Field";
import { Button } from "@/components/ui/Button";

const initial: ContactState = { status: "idle" };

export function ContactForm({ services, responseExpectation }: { services: string[]; responseExpectation?: string | null }) {
  const [state, action, pending] = useActionState(sendContact, initial);

  if (state.status === "sent") {
    return (
      <div role="status" className="border-t border-line py-10">
        <div className="thread-v mb-5 h-10 w-px" aria-hidden />
        <h2 className="text-h3">Message sent</h2>
        <p className="mt-3 max-w-prose text-ink-2">Thank you. {responseExpectation ?? ""}</p>
      </div>
    );
  }

  return (
    <form noValidate className="space-y-7" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      {/* honeypot */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>Company<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <Field label="Name" name="name" autoComplete="name" required error={state.errors?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <Field label="Subject" name="subject" maxLength={160} required error={state.errors?.subject} />
      {services.length > 0 && <Select label="Service (optional)" name="service" options={services} />}
      <TextArea label="Project or message" name="message" required hint="What are you making, and where will it be seen?" error={state.errors?.message} />

      {state.status === "error" && state.message && <p role="alert" className="text-body-sm">{state.message}</p>}
      {state.status === "fallback" && (
        <div role="status" className="border-l-2 border-violet pl-4 text-body-sm text-ink-2">
          <p>{state.message}</p>
          {state.mailto && <p className="mt-3"><a href={state.mailto} className="text-ink underline underline-offset-4">Open in your email app</a></p>}
        </div>
      )}

      <Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
