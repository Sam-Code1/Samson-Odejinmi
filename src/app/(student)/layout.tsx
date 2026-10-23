import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationBell } from "@/components/app/NotificationBell";
import { FMark, FolaLogo } from "@/components/brand/Brand";
import { PortalSideNav, PortalTabBar } from "@/components/student/PortalNav";
import { Avatar } from "@/components/student/Avatar";
import { signOut } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl, initials } from "@/lib/avatar";
import { academyRoot } from "@/app/fonts";

export const metadata = { robots: { index: false } };

/**
 * Student portal (Brand Guidelines §16 "Student dashboard"): Night by default, navy sidebar with the logo and the
 * learner at the foot; a slim top bar with search, notifications, theme and sign out. Mobile: top bar + bottom tabs.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  // avatar_path exists from migration 0015; fall back to the name-only query before that.
  let { data: p } = await supabase.from("profiles").select("first_name, last_name, avatar_path").eq("id", user.id).maybeSingle();
  if (!p) ({ data: p } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle() as unknown as { data: typeof p });
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || user.email || "Student";
  const photo = avatarUrl((p as { avatar_path?: string | null } | null)?.avatar_path);
  const init = initials(p?.first_name, p?.last_name, user.email);

  return (
    <div className={academyRoot("min-h-screen lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]")}>
      <aside className="theme-night hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-[4.5rem] items-center px-5"><Link href="/academy" aria-label="Fola Academy"><FolaLogo /></Link></div>
        <div className="flex-1 overflow-y-auto px-3 py-4"><PortalSideNav /></div>
        <Link href="/profile" className="flex items-center gap-3 border-t border-line px-5 py-4 hover:bg-elevated/60">
          <Avatar src={photo} initials={init} size={36} />
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{name}</span><span className="fa-label !text-[0.6rem]">Student</span></span>
        </Link>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <Link href="/academy" aria-label="Fola Academy" className="lg:hidden"><FMark className="h-8 w-8" /></Link>
            <div className="hidden min-w-0 flex-1 lg:block"><CommandPalette placeholder="Search your courses, lessons, resources…" /></div>
            <div className="flex items-center gap-1">
              <div className="lg:hidden"><CommandPalette placeholder="Search…" /></div>
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
      <PortalTabBar />
    </div>
  );
}
