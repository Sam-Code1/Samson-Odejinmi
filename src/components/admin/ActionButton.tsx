"use client";

import { startTransition, useActionState, useRef } from "react";
import type { ActionResult } from "@/lib/admin/result";
import { initialResult } from "@/lib/admin/result";
import { cn } from "@/lib/utils";
import { useResultToast } from "./useResultToast";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
type Variant = "ghost" | "outline" | "danger" | "primary";

const styles: Record<Variant, string> = {
  ghost: "text-ink-2 hover:bg-surface hover:text-ink",
  outline: "border border-line-strong text-ink hover:border-ink",
  danger: "border border-warm/50 text-warm hover:bg-warm/10",
  primary: "bg-ink text-canvas hover:bg-ink/90",
};

/**
 * A one-click server action with a toast, and an optional confirmation dialog.
 * Used for reorder, publish/unpublish, delete, approve and similar inline operations.
 */
export function ActionButton({ action, fields, children, variant = "ghost", confirm, ariaLabel, title, className, disabled }: {
  action: Action; fields: Record<string, string>; children: React.ReactNode; variant?: Variant; ariaLabel?: string; title?: string; className?: string; disabled?: boolean;
  confirm?: { title: string; body: string; label: string };
}) {
  const [state, dispatch, pending] = useActionState(action, initialResult);
  const dlg = useRef<HTMLDialogElement>(null);
  useResultToast(state);
  const btn = cn("inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded px-2.5 text-caption font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40", styles[variant], className);

  return (
    <form
      className="inline-block"
      onSubmit={(e) => {
        e.preventDefault();
        dlg.current?.close();
        startTransition(() => dispatch(new FormData(e.currentTarget)));
      }}
    >
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {confirm ? (
        <button type="button" onClick={() => dlg.current?.showModal()} disabled={pending || disabled} aria-label={ariaLabel} title={title} className={btn}>{children}</button>
      ) : (
        <button type="submit" disabled={pending || disabled} aria-label={ariaLabel} title={title} className={btn}>{children}</button>
      )}
      {confirm && (
        <dialog ref={dlg} aria-labelledby="confirm-title" className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-line-strong bg-elevated p-6 text-ink shadow-xl backdrop:bg-canvas/70 backdrop:backdrop-blur-sm">
          <h2 id="confirm-title" className="text-admin-section">{confirm.title}</h2>
          <p className="mt-2 text-body-sm text-ink-2">{confirm.body}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => dlg.current?.close()} className="h-9 rounded border border-line-strong px-4 text-label hover:border-ink">Cancel</button>
            <button type="submit" disabled={pending} className={cn("h-9 rounded px-4 text-label", variant === "danger" ? "bg-warm text-canvas hover:bg-warm/90" : "bg-ink text-canvas hover:bg-ink/90")}>{confirm.label}</button>
          </div>
        </dialog>
      )}
    </form>
  );
}
