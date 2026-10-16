import Link from "next/link";
import { AppNav } from "@/components/layout/AppNav";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationBell } from "@/components/app/NotificationBell";
import { Container } from "@/components/ui/Container";
import { signOut } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";

export const metadata = { robots: { index: false } };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <header className="border-b border-line">
        <Container>
          <div className="flex h-16 items-center justify-between">
            <Link href="/academy" className="text-[1.0625rem] font-medium tracking-tight">Fola Academy</Link>
            <div className="flex items-center gap-1">
              <CommandPalette placeholder="Search your courses, lessons, resources…" />
              <NotificationBell />
              <ThemeSwitcher />
              <form action={signOut}><button type="submit" className="h-11 px-3 text-label text-ink-2 hover:text-ink">Log out</button></form>
            </div>
          </div>
          <AppNav />
        </Container>
      </header>
      <main id="main"><Container className="py-12 sm:py-16">{children}</Container></main>
    </>
  );
}
