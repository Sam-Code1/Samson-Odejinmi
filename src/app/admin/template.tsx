import Link from "next/link";
import { headers } from "next/headers";
import { ShieldAlert } from "lucide-react";
import { getAdminContext } from "@/lib/admin/guard";
import { permissionForPath, ROLE_LABELS } from "@/lib/admin/roles";

/**
 * Runs on every admin navigation (templates re-render; layouts don't). Blocks areas the admin's role can't use.
 * This is the UI layer only: every server action re-checks the permission, and RLS enforces it in the database.
 */
export default async function AdminTemplate({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "/admin";
  const perm = permissionForPath(path);
  if (!perm) return <>{children}</>;
  const ctx = await getAdminContext();
  if (ctx?.can(perm)) return <>{children}</>;
  return (
    <div role="alert" className="mx-auto max-w-lg py-16">
      <ShieldAlert aria-hidden className="h-8 w-8 text-warm" strokeWidth={1.5} />
      <h1 className="mt-5 text-h3">You don&apos;t have access to this area</h1>
      <p className="mt-3 text-body text-ink-2">
        Your role{ctx ? ` (${ROLE_LABELS[ctx.role]})` : ""} doesn&apos;t include this part of the admin. If you need it, ask the Owner to change your role.
      </p>
      <Link href="/admin" className="mt-8 inline-flex h-10 items-center rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90">Back to the dashboard</Link>
    </div>
  );
}
