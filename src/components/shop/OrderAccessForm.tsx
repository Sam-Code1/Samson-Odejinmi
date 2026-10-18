"use client";

import { useActionState } from "react";
import { requestOrderLinks, type LinkState } from "@/app/shop-actions";
import { Button } from "@/components/ui/Button";

export function OrderAccessForm() {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestOrderLinks, {});
  if (state.done) {
    return <p role="status" className="rounded-xl border border-line bg-elevated p-5 text-body-sm text-ink-2">If that email has purchases, new private links are on their way to it now. Check your inbox (and spam folder) in a minute.</p>;
  }
  return (
    <form action={action} noValidate className="space-y-4">
      <div>
        <label htmlFor="oa-email" className="mb-1.5 block text-label">Purchase email</label>
        <input id="oa-email" name="email" type="email" required autoComplete="email" maxLength={254}
          className="h-12 w-full rounded border border-line-strong bg-transparent px-3 text-base focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30" />
      </div>
      <div aria-hidden className="hidden"><label>Company<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
      {state.error && <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Email me new links"}</Button>
    </form>
  );
}
