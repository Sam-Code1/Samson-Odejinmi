"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/courses", label: "My courses" },
  { href: "/library", label: "Library" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/affiliate", label: "Affiliate" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Student" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex gap-7">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={active ? "page" : undefined} className={cn("relative block whitespace-nowrap py-3 text-label", active ? "text-ink" : "text-ink-2 hover:text-ink")}>
                {l.label}
                {active && <span aria-hidden className="thread-solid absolute inset-x-0 bottom-0 h-px" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
