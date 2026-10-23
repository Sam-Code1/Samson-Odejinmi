import Link from "next/link";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { FolaLogo, IsoF, Pathway } from "@/components/brand/Brand";
import { academyRoot } from "@/app/fonts";

export const metadata = { robots: { index: false, follow: false } };

/** Sign in, register and password pages in the Fola Academy design: Night panel with the constructed F, form on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={academyRoot("grid min-h-dvh lg:grid-cols-2")}>
      <aside className="theme-night fa-blueprint relative hidden flex-col justify-between border-r border-line p-10 lg:flex xl:p-14">
        <Link href="/academy" aria-label="Fola Academy home" className="self-start"><FolaLogo descriptor /></Link>
        <div className="mx-auto w-full max-w-md"><IsoF className="h-auto w-full" /></div>
        <div>
          <p className="fa-quote text-[1.75rem] leading-snug text-ink">Software changes. Understanding compounds.</p>
          <Pathway className="mt-6 max-w-[16rem]" />
          <p className="fa-label mt-6">Learn the craft · Understand the tools · Build with purpose</p>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/academy" className="inline-flex min-h-[44px] items-center lg:invisible" aria-label="Fola Academy home"><FolaLogo /></Link>
          <ThemeSwitcher />
        </header>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-20 pt-6 sm:px-0">
          {children}
        </main>
      </div>
    </div>
  );
}
