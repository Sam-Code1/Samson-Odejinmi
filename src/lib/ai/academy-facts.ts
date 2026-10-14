import { unstable_cache } from "next/cache";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { faqAcademy } from "@/content/about";
import { course as courseContent } from "@/content/course";
import { formatMoney } from "@/lib/utils";

/**
 * Public facts the Academy chatbot may use. Built ONLY from content already public on the site: published courses,
 * their active prices and published curriculum titles, the Academy's public description and contact email, and the
 * public FAQ. Read with the anon key (RLS: published rows only). No students, payments, drafts or admin data.
 * Cached for 5 minutes and refreshed by any CMS change (tag "cms").
 */
async function build(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return "";
  const sb = createSupabase(url, key, { auth: { persistSession: false } });
  const [{ data: courses }, { data: settings }] = await Promise.all([
    sb.from("courses").select("id, slug, title, subtitle, description, level, estimated_duration, instructor, category, learning_outcomes, requirements, target_audience, certificate_enabled").eq("status", "published").order("created_at"),
    sb.from("site_settings").select("contact_email, site_name").eq("id", true).maybeSingle(),
  ]);
  const blocks: string[] = [];
  for (const c of (courses ?? []) as Record<string, unknown>[]) {
    const [{ data: prices }, { data: curriculum }] = await Promise.all([
      sb.from("course_pricing").select("currency, amount_minor").eq("course_id", c.id as string).eq("active", true),
      sb.rpc("public_course_curriculum", { p_slug: c.slug as string }),
    ]);
    const priceText = ((prices ?? []) as { currency: string; amount_minor: number }[]).map((p) => (p.amount_minor === 0 ? "Free" : formatMoney(p.amount_minor, p.currency))).join(" or ");
    const mods = Array.isArray(curriculum) ? (curriculum as { position: number; title: string; lessons: { title: string }[] }[]) : [];
    const list = (v: unknown) => (Array.isArray(v) && v.length ? (v as string[]).map((x) => `  - ${x}`).join("\n") : "  (not listed)");
    blocks.push([
      `COURSE: ${c.title}`,
      `Page: /academy/courses/${c.slug}`,
      c.subtitle && `Summary: ${c.subtitle}`,
      c.description && `Description: ${String(c.description).slice(0, 1500)}`,
      c.level && `Level: ${c.level}`,
      c.estimated_duration && `Estimated duration: ${c.estimated_duration}`,
      c.instructor && `Instructor: ${c.instructor}`,
      `Price: ${priceText || "not published yet (enrolment not open)"}`,
      `Certificate on completion: ${c.certificate_enabled ? "yes" : "no"}`,
      `Format: self-paced, one-time payment, lifetime access`,
      `Who it's for:\n${list(c.target_audience)}`,
      `What you'll learn:\n${list(c.learning_outcomes)}`,
      `Requirements:\n${list(c.requirements)}`,
      mods.length ? `Curriculum (${mods.length} modules):\n${mods.map((m) => `  ${m.position}. ${m.title} (${m.lessons.length} lessons)`).join("\n")}` : "",
    ].filter(Boolean).join("\n"));
  }
  const faq = [...faqAcademy, ...courseContent.faq].map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
  return [
    `ACADEMY: Fola Academy, by ${(settings?.site_name as string) ?? "Samson Odejinmi"}. Practical, structured creative education for beginners: understand what you're doing and why it works.`,
    `Contact: ${(settings?.contact_email as string) ?? "via the contact page"} or /contact`,
    `Courses page: /academy/courses. Student portal: /dashboard. Certificates can be verified at /verify/certificate/<ID>.`,
    blocks.length ? blocks.join("\n\n") : "No courses are published yet.",
    `PUBLIC FAQ:\n${faq}`,
  ].join("\n\n").slice(0, 40_000);
}

export const getAcademyFacts = unstable_cache(build, ["academy-facts"], { revalidate: 300, tags: ["cms"] });
