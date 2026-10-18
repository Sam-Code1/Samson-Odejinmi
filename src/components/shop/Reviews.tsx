"use client";

import { useActionState, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { reportReview, submitReview, type ReviewState } from "@/app/review-actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Read-only stars. The number is always also given as text (never colour/shape alone). */
export function Stars({ value, size = "sm", label }: { value: number; size?: "sm" | "md"; label?: string }) {
  const s = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn(s, i <= Math.round(value) ? "fill-current text-blue" : "text-line-strong")} strokeWidth={1.5} />
      ))}
    </span>
  );
}

/**
 * Review form for an owner (signed in) or a guest buyer (order token `t`). The server and database decide whether the
 * person may review; nothing here can mark a review as verified or approved.
 */
export function ReviewForm({ productId, token, defaultName }: { productId: string; token?: string; defaultName?: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const [rating, setRating] = useState(0);
  if (state.ok) return <p role="status" className="rounded-xl border border-line bg-elevated p-5 text-body-sm text-ink-2">Thank you. Your review will appear once it&apos;s been checked.</p>;
  const input = "w-full rounded border border-line-strong bg-transparent px-3 text-base focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm";
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {token && <input type="hidden" name="t" value={token} />}
      <fieldset>
        <legend className="mb-2 text-label">Your rating</legend>
        <input type="hidden" name="rating" value={rating || ""} />
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i === 1 ? "" : "s"}`} onClick={() => setRating(i)}
              className="grid h-11 w-11 place-items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40">
              <Star aria-hidden className={cn("h-6 w-6", i <= rating ? "fill-current text-blue" : "text-line-strong")} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`rv-title-${productId}`} className="mb-1.5 block text-label">Title <span className="text-ink-3">(optional)</span></label>
        <input id={`rv-title-${productId}`} name="title" maxLength={120} className={cn(input, "h-11")} />
      </div>
      <div>
        <label htmlFor={`rv-body-${productId}`} className="mb-1.5 block text-label">Review <span className="text-ink-3">(optional)</span></label>
        <textarea id={`rv-body-${productId}`} name="body" rows={4} maxLength={4000} className={cn(input, "py-2.5")} />
      </div>
      <div>
        <label htmlFor={`rv-name-${productId}`} className="mb-1.5 block text-label">Name shown with your review</label>
        <input id={`rv-name-${productId}`} name="display_name" maxLength={60} defaultValue={defaultName} className={cn(input, "h-11")} />
      </div>
      {state.error && <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm text-ink-2">{state.error}</p>}
      <Button type="submit" disabled={pending || !rating}>{pending ? "Sending…" : "Submit review"}</Button>
    </form>
  );
}

export function ReportReview({ reviewId }: { reviewId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (msg) return <span role="status" className="text-caption text-ink-3">{msg}</span>;
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setMsg((await reportReview(reviewId)).message))}
      className="inline-flex min-h-[44px] items-center text-caption text-ink-3 underline underline-offset-4 hover:text-ink">Report</button>
  );
}
