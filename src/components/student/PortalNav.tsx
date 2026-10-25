"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Gift, Home, Library, Settings, User, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";

export const PORTAL_NAV = [
  { href: "/dashboard", label: "My learning", icon: Waypoints },
  { href: "/courses", label: "Courses", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/academy/books", label: "Books", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/affiliate", label: "Affiliate", icon: Gift },
];
const isOn = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Sidebar navigation (desktop). Active item: raised surface + accent text, never colour alone (aria-current). */
export function PortalSideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Student portal">
      <ul className="space-y-1">
        {PORTAL_NAV.map(({ href, label, icon: Icon }) => {
          const on = isOn(path, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={cn("flex min-h-[40px] items-center gap-3 rounded-[6px] px-3 text-sm font-medium transition-colors duration-[160ms]", on ? "bg-elevated text-ink" : "text-ink-2 hover:bg-elevated/60 hover:text-ink")}>
                <Icon aria-hidden className={cn("h-[18px] w-[18px]", on ? "text-blue" : "text-ink-3")} strokeWidth={1.5} />{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom tab bar (mobile, §16 Mobile): Learn · Courses · Library · Earn (affiliate) · Me. */
export function PortalTabBar() {
  const path = usePathname();
  const tabs = [
    { href: "/dashboard", label: "Learn", icon: Waypoints },
    { href: "/courses", label: "Courses", icon: Home },
    { href: "/library", label: "Library", icon: Library },
    { href: "/affiliate", label: "Earn", icon: Gift },
    { href: "/profile", label: "Me", icon: User, also: ["/settings"] },
  ];
  return (
    <nav aria-label="Student portal" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, also }) => {
          const on = isOn(path, href) || (also ?? []).some((a) => isOn(path, a));
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={cn("flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", on ? "text-blue" : "text-ink-3")}>
                <Icon aria-hidden className="h-5 w-5" strokeWidth={1.5} />{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
