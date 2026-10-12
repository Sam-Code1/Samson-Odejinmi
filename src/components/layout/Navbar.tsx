"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { academyNav, mainNav, site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "./ThemeSwitcher";

function isActive(pathname: string, href: string) {
  const base = href.split("#")[0];
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}

export function Navbar({ variant = "main", siteName = site.name, logoUrl }: { variant?: "main" | "academy"; siteName?: string; logoUrl?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = variant === "academy" ? academyNav : mainNav;

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-page items-center justify-between px-5 sm:px-8 lg:h-[4.5rem] lg:px-12">
        {variant === "academy" ? (
          <div className="flex items-baseline gap-4">
            <Link href="/academy" className="text-[1.0625rem] font-medium tracking-tight">Fola Academy</Link>
            <Link href="/" className="hidden text-caption text-ink-3 transition-colors hover:text-ink sm:inline">by {site.name}</Link>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-3 text-[1.0625rem] font-medium tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" className="h-7 w-auto" />}
            {siteName}
          </Link>
        )}

        <ul className="hidden items-center gap-9 lg:flex">
          {links.map((l) => {
            const active = isActive(pathname, l.href) && !l.href.includes("#");
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={active ? "page" : undefined} className={cn("relative py-2 text-label transition-colors", active ? "text-ink" : "text-ink-2 hover:text-ink")}>
                  {l.label}
                  {active && <span aria-hidden className="thread-solid absolute inset-x-0 -bottom-px h-px" />}
                </Link>
              </li>
            );
          })}
          {variant === "academy" && (
            <li>
              <Link href="/" className="text-label text-ink-3 transition-colors hover:text-ink">Main site</Link>
            </li>
          )}
          <li><ThemeSwitcher /></li>
        </ul>

        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center"
          >
            <span aria-hidden className="relative block h-3 w-6">
              <span className={cn("absolute left-0 h-px w-6 bg-ink transition-all duration-base ease-quiet", open ? "top-1.5 rotate-45" : "top-0")} />
              <span className={cn("absolute left-0 h-px w-6 bg-ink transition-all duration-base ease-quiet", open ? "top-1.5 -rotate-45" : "top-3")} />
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-canvas px-5 pb-10 pt-8 sm:px-8 lg:hidden">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href} className="border-b border-line">
                <Link href={l.href} className="flex min-h-[4.25rem] items-center text-h3" onClick={() => setOpen(false)}>{l.label}</Link>
              </li>
            ))}
            {variant === "academy" && (
              <li className="border-b border-line">
                <Link href="/" className="flex min-h-[4.25rem] items-center text-h3 text-ink-2">Main site</Link>
              </li>
            )}
          </ul>
          <div className="mt-8">
            <p className="mb-3 text-caption text-ink-3">Theme</p>
            <ThemeSwitcher inline />
          </div>
        </div>
      )}
    </header>
  );
}
