import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { NotificationBell } from "@/components/app/NotificationBell";
import { FMark, FolaLogo } from "@/components/brand/Brand";
import { AffiliateSideNav, AffiliateTabBar } from "@/components/affiliate/AffiliateNav";
import { Avatar } from "@/components/student/Avatar";
import { signOut } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl, initials } from "@/lib/avatar";
import { academyRoot } from "@/app/fonts";

export const metadata = { title: { default: "Affiliate", template: "%s · Affiliate · Fola Academy" }, robots: { index: false, follow: false } };

/**
 * The affiliate area: its own dashboard for anyone with an account, student or not, laid out like the student portal:
 * a navy sidebar on laptops (with a way back to learning), a slim top bar, and a bottom tab bar on phones.
 */
export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/affiliate");
  const supabase = await createClient();
  let { data: p } = await supabase.from("profiles").select("first_name, last_name, avatar_path").eq("id", user.id).maybeSingle();
  if (!p) ({ data: p } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle() as unknown as { data: typeof p });
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || user.email || "Affiliate";
  const photo = avatarUrl((p as { avatar_path?: string | null } | null)?.avatar_path);
  const init = initials(p?.first_name, p?.last_name, user.email);

  return (
    <div className={academyRoot("min-h-screen lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]")}>
      <aside className="theme-night hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-[4.5rem] items-center px-5"><Link href="/academy" aria-label="Fola Academy"><FolaLogo /></Link></div>
        <div className="flex-1 overflow-y-auto px-3 py-4"><AffiliateSideNav /></div>
        <Link href="/profile" className="flex items-center gap-3 border-t border-line px-5 py-4 hover:bg-elevated/60">
          <Avatar src={photo} initials={init} size={36} />
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{name}</span><span className="fa-label !text-[0.6rem]">Affiliate</span></span>
        </Link>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <Link href="/academy" aria-label="Fola Academy" className="lg:hidden"><FMark className="h-8 w-8" /></Link>
            <p className="fa-label hidden lg:block">Affiliate programme</p>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeSwitcher />
              <form action={signOut}>
                <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-[6px] px-3 text-sm font-medium text-ink-2 hover:text-ink" aria-label="Log out">
                  <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span className="hidden sm:inline">Log out</span>
                </button>
              </form>
              <Link href="/profile" className="ml-1 lg:hidden" aria-label="Your profile"><Avatar src={photo} initials={init} size={32} /></Link>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-10 lg:pb-16">{children}</main>
      </div>
      <AffiliateTabBar />
    </div>
  );
}
