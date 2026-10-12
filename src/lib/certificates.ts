import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, templates } from "@/lib/email";

/**
 * Emails newly issued certificates to the signed-in student, exactly once each. Certificates themselves are issued by
 * the database (recompute_course_progress); claim_certificate_notifications() marks them notified atomically.
 * If email isn't configured the certificate still exists and shows on the dashboard; nothing pretends it was emailed.
 */
export async function notifyNewCertificates(supabase: SupabaseClient, user: { email?: string | null }, firstName: string) {
  if (!user.email) return;
  const { data, error } = await supabase.rpc("claim_certificate_notifications");
  if (error || !Array.isArray(data)) return;
  for (const c of data as { number: string; course: string }[]) {
    const res = await sendEmail({ to: user.email, ...templates.certificate({ name: firstName, course: c.course, number: c.number }) });
    if (!res.sent) console.warn("[email] certificate notification not sent:", res.reason);
  }
}
