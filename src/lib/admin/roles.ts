/**
 * Admin roles and permissions. The DATABASE is the authority (public.has_admin_permission, latest in migration 0008, enforced
 * by RLS and checked again in every server action). This mirror exists only so the UI can hide what a role can't use.
 * Keep the two in sync.
 */
export const ADMIN_ROLES = ["owner", "super_admin", "academy_admin", "content_manager", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Permission =
  | "website" | "media" | "academy" | "ai" | "students" | "enrolments" | "certificates" | "payments" | "coupons" | "settings" | "activity" | "admins"
  | "products" | "marketing" | "customers" | "affiliates";

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  super_admin: "Super Admin",
  academy_admin: "Academy Admin",
  content_manager: "Content Manager",
  support: "Support",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: "Everything, including admins, payments, integrations and security.",
  super_admin: "Everything except managing admins and ownership.",
  academy_admin: "Courses, modules, lessons, quizzes, AI tools, products, students, enrolments, certificates and media.",
  content_manager: "Website content, portfolio, services, media, products, coupons and marketing (campaigns, email, automations).",
  support: "Students, enrolments and customer records.",
};

export function can(role: AdminRole | null | undefined, p: Permission): boolean {
  switch (role) {
    case "owner": return true;
    case "super_admin": return p !== "admins";
    case "academy_admin": return ["academy", "media", "ai", "students", "enrolments", "certificates", "products"].includes(p);
    case "content_manager": return ["website", "media", "coupons", "marketing", "products"].includes(p);
    case "support": return ["students", "enrolments", "customers"].includes(p);
    default: return false;
  }
}

/** Which permission each admin area needs. The first matching prefix wins; "/admin" itself is open to every admin. */
const ROUTE_PERMS: [string, Permission][] = [
  ["/admin/website", "website"],
  ["/admin/media", "media"],
  ["/admin/ai", "ai"],
  ["/admin/courses", "academy"], ["/admin/modules", "academy"], ["/admin/lessons", "academy"], ["/admin/quizzes", "academy"],
  ["/admin/questions", "academy"], ["/admin/resources", "academy"],
  ["/admin/students", "students"],
  ["/admin/enrolments", "enrolments"],
  ["/admin/certificates", "certificates"],
  ["/admin/payments", "payments"],
  ["/admin/settings/payments", "payments"],
  ["/admin/system/health", "settings"],
  ["/admin/system/security", "activity"],
  ["/admin/coupons", "coupons"],
  ["/admin/products", "products"],
  ["/admin/marketing/customers", "customers"],
  ["/admin/marketing/affiliates", "affiliates"],
  ["/admin/marketing", "marketing"],
  ["/admin/admins", "admins"],
  ["/admin/activity", "activity"],
  ["/admin/settings", "settings"],
];

export function permissionForPath(pathname: string): Permission | null {
  const hit = ROUTE_PERMS.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  return hit ? hit[1] : null;
}

export const isAdminRole = (v: unknown): v is AdminRole => typeof v === "string" && (ADMIN_ROLES as readonly string[]).includes(v);
