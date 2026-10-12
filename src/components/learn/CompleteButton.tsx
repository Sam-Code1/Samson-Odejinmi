"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

export function CompleteButton({ completed }: { completed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={completed ? "secondary" : "primary"} disabled={pending}>
      {pending ? "Saving…" : completed ? "Completed. Undo" : "Mark complete"}
    </Button>
  );
}
