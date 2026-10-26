import Link from "next/link";
import { LogOut } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { FolaLogo } from "@/components/brand/Brand";
import { AffiliateTabBar, AffiliateTabs } from "@/components/affiliate/AffiliateNav";
import { signOut } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";
import { academyRoot } from "@/app/fonts";

export const metadata = { title: { default: "Affiliate", template: "%s · Affiliate · Fola Academy" }, robots: { index: false, follow: false } };

/**
 * The affiliate area: its own dashboard for anyone with an account, student or not. Phone-first: a slim header and a
 * bottom tab bar; on larger screens a tab row under the header.
 */
export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/affiliate");
  return (
    <div className={academyRoot("min-h-screen bg-canvas text-ink")}>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/academy" aria-label="Fola Academy home" className="inline-flex min-h-[44px] items-center"><FolaLogo /></Link>
            <span className="fa-label hidden border-l border-line pl-3 sm:inline">Affiliate</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/dashboard" className="hidden min-h-[44px] items-center px-3 text-sm font-medium text-ink-2 hover:text-ink md:inline-flex">My learning</Link>
            <Link href="/affiliates" className="hidden min-h-[44px] items-center px-3 text-sm font-medium text-ink-2 hover:text-ink md:inline-flex">Programme</Link>
            <ThemeSwitcher />
            <form action={signOut}>
              <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-[6px] px-3 text-sm font-medium text-ink-2 hover:text-ink" aria-label="Log out">
                <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </div>
        </div>
        <AffiliateTabs />
      </header>
      <main id="main" className="mx-auto w-full max-w-[1100px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:px-10 md:pb-16">{children}</main>
      <AffiliateTabBar />
    </div>
  );
}
