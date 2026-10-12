"use client";

import { useEffect } from "react";
import type { ActionResult } from "@/lib/admin/result";
import { useToast } from "./Toast";

/** Shows a toast whenever an action finishes. Never silent: errors always say what to fix. */
export function useResultToast(state: ActionResult, onSuccess?: () => void) {
  const toast = useToast();
  useEffect(() => {
    if (state.ok && state.message) { toast("success", state.message); onSuccess?.(); }
    else if (state.error) toast("error", state.error);
    else if (state.fieldErrors && Object.keys(state.fieldErrors).length) toast("error", "Please fix the highlighted fields.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
