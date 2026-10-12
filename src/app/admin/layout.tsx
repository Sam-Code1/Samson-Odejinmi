import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminContext } from "@/lib/admin/guard";
import { getUser } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

function Notice({ title, body, links }: { title: string; body: string; links: { href: string; label: string }[] }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <div className="thread-v mb-6 h-10 w-px" aria-hidden />
      <h1 className="text-h3">{title}</h1>
      <p className="mt-3 text-body text-ink-2">{body}</p>
      <div className="mt-8 flex flex-wrap gap-5 text-label">
        {links.map((l) => <Link key={l.href} href={l.href} className="underline underline-offset-4 hover:text-ink">{l.label}</Link>)}
      </div>
    </main>
  );
}

/** Authorisation is enforced here, on the server, for every /admin page. Hiding links is never the protection. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) {
    return <Notice title="Supabase isn't connected" body="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the server." links={[{ href: "/", label: "Back to the site" }]} />;
  }
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  const ctx = await getAdminContext();
  if (!ctx) {
    return <Notice title="You don't have access to the admin area" body="This area is for Academy administrators. If you think you should have access, ask the site owner to add your account." links={[{ href: "/dashboard", label: "Go to your dashboard" }, { href: "/academy", label: "Visit the Academy" }]} />;
  }
  return <AdminShell email={ctx.user.email}>{children}</AdminShell>;
}
