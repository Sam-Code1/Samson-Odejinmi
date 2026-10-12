import { revalidatePath, revalidateTag } from "next/cache";
import type { AdminContext } from "./guard";

/**
 * Audit trail for important admin actions. Never logs secrets or content bodies: only who, what, which record, when.
 * Logging is best-effort: a failed log write never blocks the change itself.
 */
export async function logActivity(ctx: AdminContext, action: string, resourceType: string, resourceId?: string | null, resourceLabel?: string | null) {
  try {
    await ctx.supabase.from("activity_logs").insert({
      actor_id: ctx.user.id, actor_email: ctx.user.email ?? null, action: action.slice(0, 80), resource_type: resourceType.slice(0, 40),
      resource_id: resourceId ?? null, resource_label: resourceLabel ? resourceLabel.slice(0, 160) : null,
    });
  } catch {
    /* best effort */
  }
}

/** Public website content is cached; any CMS change refreshes every public page. */
export function revalidateSite() {
  revalidateTag("cms");
  revalidatePath("/", "layout");
}
