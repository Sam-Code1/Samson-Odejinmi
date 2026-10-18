"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, str } from "@/lib/admin/validation";
import { logActivity, revalidateSite } from "@/lib/admin/activity";

/** Review moderation ("products" permission). Enforced again by RLS (migration 0014). */
const STATUSES = ["pending", "approved", "rejected", "hidden", "flagged"] as const;

export async function moderateReview(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "reviewId", 40), status = str(fd, "status", 20);
    if (!isUuid(id) || !(STATUSES as readonly string[]).includes(status)) return { ok: false, message: "Invalid request." };
    const { error } = await ctx.supabase.from("product_reviews").update({ status, moderated_by: ctx.user.id, moderated_at: new Date().toISOString() }).eq("id", id);
    if (error) return dbError(error, "Couldn't update the review. Run migration 0014 first.");
    await logActivity(ctx, `review ${status}`, "product_review", id, status);
    revalidateSite();
    revalidatePath("/admin/reviews");
    return { ok: true, message: status === "approved" ? "Approved. It's now public." : status === "pending" ? "Moved back to pending." : `Review ${status}.` };
  });
}

export async function deleteReview(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "reviewId", 40);
    if (!isUuid(id)) return { ok: false, message: "Invalid request." };
    const { error } = await ctx.supabase.from("product_reviews").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete the review.");
    await logActivity(ctx, "review deleted", "product_review", id, "deleted");
    revalidateSite();
    revalidatePath("/admin/reviews");
    return { ok: true, message: "Review deleted." };
  });
}
