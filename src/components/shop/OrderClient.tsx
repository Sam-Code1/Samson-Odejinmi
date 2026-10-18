"use client";

import { startTransition, useActionState, useEffect } from "react";
import { claimOrder, clearPurchased, type ClaimState } from "@/app/shop-actions";
import { Button } from "@/components/ui/Button";

/** Once an order is paid, the bought items leave the cart (the cart cookie lives in the browser). */
export function ClearPurchasedCart({ keys }: { keys: string[] }) {
  const sig = keys.join(",");
  useEffect(() => {
    if (!sig) return;
    void clearPurchased(sig.split(",")).then(() => window.dispatchEvent(new Event("fola:cart")));
  }, [sig]);
  return null;
}

/** Adds this guest order to the signed-in account. The server re-checks the session AND the order token. */
export function ClaimButton({ token, label = "Add to my Library" }: { token: string; label?: string }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimOrder, {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <input type="hidden" name="t" value={token} />
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : label}</Button>
      {state.error && <p role="alert" className="mt-3 border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}</p>}
    </form>
  );
}
