import Link from "next/link";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-page items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/academy" className="inline-flex min-h-[44px] items-center text-[1.0625rem] font-medium tracking-tight">Fola Academy</Link>
        <ThemeSwitcher />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-20 pt-8 sm:px-0">
        {children}
      </main>
    </div>
  );
}
