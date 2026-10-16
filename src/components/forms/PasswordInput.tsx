"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Password input with a show/hide button. Hidden by default. The button is type="button" (never submits the form),
 * keyboard-focusable, has an aria-label that says what it will do, and aria-pressed for its state. 44px touch target.
 * The value is never copied anywhere: only the input's `type` changes.
 */
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { inputClassName?: string }>(
  // `type` is accepted (callers pass type="password") but ignored: this component controls it.
  function PasswordInput({ className, inputClassName, type: _type, ...rest }, ref) {
    const [shown, setShown] = useState(false);
    return (
      <div className={cn("relative", className)}>
        <input ref={ref} {...rest} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={cn(inputClassName, "pr-12")} />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={rest.id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-ink-3 transition-colors hover:text-ink focus-visible:outline-offset-[-2px]"
        >
          {shown ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
