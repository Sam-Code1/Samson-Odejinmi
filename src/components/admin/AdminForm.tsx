"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { ActionResult } from "@/lib/admin/result";
import { initialResult } from "@/lib/admin/result";
import { cn } from "@/lib/utils";
import { FormErrorsContext } from "./FormContext";
import { useResultToast } from "./useResultToast";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/**
 * Standard admin form. Submits via a transition (so React doesn't wipe your inputs when validation fails),
 * shows field errors inline, a toast on every result, and warns before leaving with unsaved changes.
 * Extra buttons can be passed as `extra` (e.g. "Publish"); give them name="intent".
 */
export function AdminForm({ action, children, submitLabel = "Save changes", saveIntent, extra, className, stickyBar = true }: {
  action: Action; children: React.ReactNode; submitLabel?: string; saveIntent?: string; extra?: React.ReactNode; className?: string; stickyBar?: boolean;
}) {
  // A request that fails outright (dropped connection, a body over the host's size limit) becomes a message on the
  // form instead of the error page. Next.js redirects (digest NEXT_…) still pass through.
  const [state, dispatch, pending] = useActionState(async (prev: ActionResult, fd: FormData): Promise<ActionResult> => {
    try {
      return await action(prev, fd);
    } catch (e) {
      if (e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_")) throw e;
      return { ok: false, error: "That didn't go through. Check your connection and try again. If you were uploading a large file (over about 4 MB), it may be too big to send this way." };
    }
  }, initialResult);
  const [dirty, setDirty] = useState(false);
  useResultToast(state, () => setDirty(false));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <FormErrorsContext.Provider value={state.fieldErrors ?? {}}>
      <form
        noValidate
        className={cn("space-y-6", className)}
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          startTransition(() => dispatch(fd));
        }}
      >
        {children}
        <div className={cn("flex flex-wrap items-center gap-3", stickyBar && "sticky bottom-3 z-20 rounded-xl border border-line bg-elevated/90 px-4 py-3 shadow-[var(--ad-shadow)] backdrop-blur-xl sm:px-5")}>
          <button type="submit" name={saveIntent ? "intent" : undefined} value={saveIntent} disabled={pending} className="h-10 rounded-lg bg-action px-5 text-label text-on-action transition-colors hover:bg-action-hover disabled:opacity-60">
            {pending ? "Saving…" : submitLabel}
          </button>
          {extra}
          {dirty && !pending && <span role="status" className="text-caption text-ink-3">Unsaved changes</span>}
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
