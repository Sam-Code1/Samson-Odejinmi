"use server";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/guard";
import type { Permission } from "@/lib/admin/roles";

/**
 * Signed-in app features shared by the admin and student areas: notifications and global search.
 * Everything runs as the signed-in person (RLS), so nobody sees rows their role can't already read.
 */
export type NotificationItem = { id: string; kind: string; title: string; body: string | null; link: string | null; created_at: string; is_read: boolean };

export async function getMyNotifications(): Promise<{ items: NotificationItem[]; unread: number } | null> {
  if (!(await getUser())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_notifications", { p_limit: 30 });
  if (error) return null; // before migration 0009
  const items = (data ?? []) as NotificationItem[];
  return { items, unread: items.filter((i) => !i.is_read).length };
}

export async function markNotificationsRead(ids: string[] | null): Promise<boolean> {
  if (!(await getUser())) return false;
  const clean = ids ? ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: clean });
  return !error;
}

export type SearchHit = { group: string; title: string; subtitle?: string; href: string };

const clean = (q: string) => q.trim().replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").slice(0, 60);

/** Global search (Cmd/Ctrl+K). Admins: areas their role can access. Students: their courses, lessons and resources. */
export async function globalSearch(raw: string): Promise<SearchHit[]> {
  const q = clean(String(raw ?? ""));
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const admin = await getAdminContext();
  if (admin) {
    const sb = admin.supabase;
    const tasks: [Permission, () => PromiseLike<SearchHit[]>][] = [
      ["students", () => sb.from("profiles").select("id, first_name, last_name, email").or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Students", title: `${r.first_name} ${r.last_name}`.trim() || (r.email as string), subtitle: r.email as string, href: `/admin/students/${r.id}` })))],
      ["customers", () => sb.from("contacts").select("id, email, first_name").or(`email.ilike.${like},first_name.ilike.${like}`).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Customers", title: (r.first_name as string) || (r.email as string), subtitle: r.email as string, href: `/admin/marketing/customers/${r.id}` })))],
      ["products", () => sb.from("products").select("id, name, product_type, status").ilike("name", like).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Products", title: r.name as string, subtitle: `${r.product_type} · ${r.status}`, href: `/admin/products/${r.id}` })))],
      ["academy", () => sb.from("courses").select("id, title, status").ilike("title", like).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Courses", title: r.title as string, subtitle: r.status as string, href: `/admin/courses/${r.id}` })))],
      ["payments", () => sb.from("payments").select("reference, amount_minor, currency, status").ilike("reference", like).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Payments", title: r.reference as string, subtitle: `${r.currency} ${(Number(r.amount_minor) / 100).toLocaleString()} · ${r.status}`, href: `/admin/payments?q=${encodeURIComponent(r.reference as string)}` })))],
      ["website", () => sb.from("contact_messages").select("id, name, email, message").or(`name.ilike.${like},email.ilike.${like},message.ilike.${like}`).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Messages", title: r.name as string, subtitle: String(r.message).slice(0, 70), href: `/admin/website/messages/${r.id}` })))],
      ["coupons", () => sb.from("coupons").select("id, code").ilike("code", like).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Coupons", title: r.code as string, href: `/admin/coupons/${r.id}` })))],
      ["affiliates", () => sb.from("affiliates").select("id, code, status").ilike("code", like).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Affiliates", title: r.code as string, subtitle: r.status as string, href: `/admin/marketing/affiliates/${r.id}` })))],
      ["certificates", () => sb.from("certificates").select("certificate_number").ilike("certificate_number", like).limit(5)
        .then(({ data }) => (data ?? []).map((r) => ({ group: "Certificates", title: r.certificate_number as string, href: `/admin/certificates?q=${encodeURIComponent(r.certificate_number as string)}` })))],
    ];
    const results = await Promise.all(tasks.filter(([p]) => admin.can(p)).map(([, run]) => Promise.resolve(run()).catch(() => [] as SearchHit[])));
    return results.flat();
  }

  if (!(await getUser())) return [];
  const sb = await createClient();
  // RLS limits lessons and resources to courses the student is enrolled in.
  const [courses, lessons, resources] = await Promise.all([
    sb.from("enrolments").select("courses!inner(title, slug)").in("status", ["active", "completed"]).ilike("courses.title", like).limit(5),
    sb.from("lessons").select("title, slug, courses(slug, title)").eq("status", "published").ilike("title", like).limit(8),
    sb.from("lesson_resources").select("id, title").ilike("title", like).limit(5),
  ]);
  return [
    ...((courses.data ?? []) as unknown as { courses: { title: string; slug: string } }[]).map((r) => ({ group: "My courses", title: r.courses.title, href: `/learn/${r.courses.slug}` })),
    ...((lessons.data ?? []) as unknown as { title: string; slug: string; courses: { slug: string; title: string } | null }[]).filter((l) => l.courses).map((l) => ({ group: "Lessons", title: l.title, subtitle: l.courses!.title, href: `/learn/${l.courses!.slug}/${l.slug}` })),
    ...((resources.data ?? []) as { id: string; title: string }[]).map((r) => ({ group: "Resources", title: r.title, href: `/api/resources/${r.id}` })),
  ];
}
