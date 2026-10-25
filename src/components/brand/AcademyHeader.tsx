"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { FolaLogo } from "./Brand";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CartLink } from "@/components/shop/CartClient";
import { cn } from "@/lib/utils";
import { academyRoot } from "@/app/fonts";

const active = (path: string, href: string) => {
  const base = href.split("#")[0];
  return !href.includes("#") && (path === base || path.startsWith(base + "/"));
};

/**
 * Academy header (§16 Website): horizontal lockup top-left, navigation, then "My learning" and ONE primary action.
 * Solid Night/Paper bar with a hairline (no blur glows). Mobile: a full-height sheet rendered in a portal.
 */
export function AcademyHeader({ nav }: { nav: { href: string; label: string }[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas">
      <nav aria-label="Academy" className="mx-auto flex h-16 w-full max-w-[1248px] items-center justify-between gap-6 px-4 sm:px-6 lg:h-[4.5rem]">
        <Link href="/academy" aria-label="Fola Academy home" className="inline-flex min-h-[44px] items-center"><FolaLogo /></Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {nav.map((l) => {
            const on = active(path, l.href);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={on ? "page" : undefined}
                  className={cn("relative py-2 text-sm font-medium tracking-[0.01em] transition-colors", on ? "text-ink" : "text-ink-2 hover:text-ink")}>
                  {l.label}
                  {on && <span aria-hidden className="thread-solid absolute inset-x-0 -bottom-[1px] h-[2px]" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <CartLink />
          <div className="hidden sm:block"><ThemeSwitcher /></div>
          <Link href="/login" className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-ink hover:underline hover:underline-offset-4">Log in</Link>
          <Link href="/dashboard" className="hidden min-h-[44px] items-center px-2 text-sm font-medium text-blue hover:underline hover:underline-offset-4 lg:inline-flex">My learning</Link>
          <Link href="/academy/courses" className="fa-btn fa-btn-primary fa-btn-sm hidden sm:inline-flex">Start learning<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="fa-menu" aria-label="Open menu"
            className="grid h-11 w-11 place-items-center rounded-md text-ink lg:hidden"><Menu aria-hidden className="h-5 w-5" /></button>
        </div>
      </nav>

      {mounted && open && createPortal(
        <div id="fa-menu" role="dialog" aria-modal="true" aria-label="Menu" className={academyRoot("fixed inset-0 z-50 flex flex-col bg-canvas")}>
          <div className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-6">
            <FolaLogo />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-md"><X aria-hidden className="h-5 w-5" /></button>
          </div>
          <div className="flex flex-1 flex-col justify-between overflow-y-auto px-4 py-8 sm:px-6">
            <ul className="space-y-1">
              {[...nav, { href: "/login", label: "Log in" }, { href: "/dashboard", label: "My learning" }, { href: "/library", label: "Library" }, { href: "/affiliates", label: "Affiliate programme" }].map((l, i) => (
                <li key={l.href} className="fa-rise" style={{ animationDelay: `${i * 50}ms` }}>
                  <Link href={l.href} className="flex min-h-[56px] items-center justify-between border-b border-line text-h3">
                    {l.label}<ArrowRight aria-hidden className="h-5 w-5 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10 space-y-4">
              <Link href="/academy/courses" className="fa-btn fa-btn-primary fa-btn-lg w-full">Start learning</Link>
              <div className="flex items-center justify-between"><span className="fa-label">Theme</span><ThemeSwitcher inline /></div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
