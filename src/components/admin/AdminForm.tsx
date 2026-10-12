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
  const [state, dispatch, pending] = useActionState(action, initialResult);
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
        <div className={cn("flex flex-wrap items-center gap-3", stickyBar && "sticky bottom-0 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-lg lg:border lg:px-5")}>
          <button type="submit" name={saveIntent ? "intent" : undefined} value={saveIntent} disabled={pending} className="h-10 rounded bg-ink px-5 text-label text-canvas transition-colors hover:bg-ink/90 disabled:opacity-60">
            {pending ? "Saving…" : submitLabel}
          </button>
          {extra}
          {dirty && !pending && <span role="status" className="text-caption text-ink-3">Unsaved changes</span>}
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
