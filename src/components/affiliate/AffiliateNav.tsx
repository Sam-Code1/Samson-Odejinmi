"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Link2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/affiliate", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/affiliate/links", label: "Links", icon: Link2, exact: false },
  { href: "/affiliate/earnings", label: "Earnings", icon: Wallet, exact: false },
];
const on = (path: string, href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

/** Desktop: a tab row inside the header. */
export function AffiliateTabs() {
  const path = usePathname();
  return (
      <nav aria-label="Affiliate" className="hidden border-t border-line md:block">
        <ul className="mx-auto flex max-w-[1100px] gap-1 px-6 lg:px-10">
          {ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const current = on(path, href, exact);
            return (
              <li key={href}>
                <Link href={href} aria-current={current ? "page" : undefined}
                  className={cn("relative inline-flex min-h-[48px] items-center gap-2 px-3 text-sm font-medium transition-colors", current ? "text-ink" : "text-ink-2 hover:text-ink")}>
                  <Icon aria-hidden className={cn("h-4 w-4", current ? "text-blue" : "text-ink-3")} strokeWidth={1.5} />{label}
                  {current && <span aria-hidden className="thread-solid absolute inset-x-3 -bottom-px h-[2px]" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}

/**
 * Phones: a bottom tab bar. It must live OUTSIDE the header: the header has a backdrop blur, and a blurred ancestor makes
 * position:fixed children stick to the header (the top) instead of the screen.
 */
export function AffiliateTabBar() {
  const path = usePathname();
  return (
      <nav aria-label="Affiliate" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {[...ITEMS, { href: "/dashboard", label: "Learning", icon: BookOpen, exact: false }].map(({ href, label, icon: Icon, exact }) => {
            const current = on(path, href, exact);
            return (
              <li key={href}>
                <Link href={href} aria-current={current ? "page" : undefined} className={cn("flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", current ? "text-blue" : "text-ink-3")}>
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.5} />{label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
