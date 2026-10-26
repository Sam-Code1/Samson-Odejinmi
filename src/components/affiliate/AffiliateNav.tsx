"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, GraduationCap, Info, LayoutDashboard, Library, Link2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/affiliate", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/affiliate/links", label: "Links", icon: Link2, exact: false },
  { href: "/affiliate/earnings", label: "Earnings", icon: Wallet, exact: false },
];
const on = (path: string, href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

/** Laptop: the sidebar, in the same style as the student portal. */
export function AffiliateSideNav() {
  const path = usePathname();
  const item = (href: string, label: string, Icon: typeof BookOpen, current: boolean) => (
    <li key={href}>
      <Link href={href} aria-current={current ? "page" : undefined}
        className={cn("flex min-h-[40px] items-center gap-3 rounded-[6px] px-3 text-sm font-medium transition-colors duration-[160ms]", current ? "bg-elevated text-ink" : "text-ink-2 hover:bg-elevated/60 hover:text-ink")}>
        <Icon aria-hidden className={cn("h-[18px] w-[18px]", current ? "text-blue" : "text-ink-3")} strokeWidth={1.5} />{label}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Affiliate">
      <ul className="space-y-1">{ITEMS.map(({ href, label, icon, exact }) => item(href, label, icon, on(path, href, exact)))}</ul>
      <p className="fa-label mb-2 mt-8 px-3 !text-[0.6rem]">Fola Academy</p>
      <ul className="space-y-1">
        {item("/dashboard", "My learning", BookOpen, false)}
        {item("/academy/courses", "Courses", GraduationCap, false)}
        {item("/academy/books", "Books", Library, false)}
        {item("/affiliates", "Programme details", Info, false)}
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
      <nav aria-label="Affiliate" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
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
