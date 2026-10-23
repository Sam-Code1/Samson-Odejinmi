"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { studioRoot } from "@/app/fonts";
import { cn } from "@/lib/utils";

export const STUDIO_NAV = [
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/academy", label: "Academy" },
  { href: "/academy/books", label: "Books" },
  { href: "/contact", label: "Contact" },
];
const on = (path: string, href: string) => path === href || (href !== "/" && path.startsWith(href + "/")) || (href === "/work" && path.startsWith("/portfolio"));

/** Main-site header: name as the wordmark, the work first, one primary action. Solid bar, hairline. */
export function StudioHeader({ name = "Samson Odejinmi", hide = [] }: { name?: string; hide?: string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const nav = STUDIO_NAV.filter((n) => !hide.includes(n.href));
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", k); };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/92 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:h-[4.5rem] lg:px-10">
        <Link href="/" className="group inline-flex min-h-[44px] flex-col justify-center leading-none">
          <span className="text-[1.0625rem] font-extrabold tracking-[-0.02em]">{name}</span>
          <span className="fa-label mt-1 !text-[0.56rem]">3D · Design · Technology</span>
        </Link>
        <ul className="hidden items-center gap-7 lg:flex">
          {nav.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={on(path, l.href) ? "page" : undefined}
                className={cn("relative py-2 text-sm font-medium transition-colors", on(path, l.href) ? "text-ink" : "text-ink-2 hover:text-ink")}>
                {l.label}
                {on(path, l.href) && <span aria-hidden className="thread-solid absolute inset-x-0 -bottom-px h-[2px]" />}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden sm:block"><ThemeSwitcher /></div>
          <Link href="/contact" className="hidden h-10 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover sm:inline-flex">
            Start a project<ArrowUpRight aria-hidden className="h-4 w-4" />
          </Link>
          <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="st-menu" aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-md lg:hidden"><Menu aria-hidden className="h-5 w-5" /></button>
        </div>
      </nav>
      {mounted && open && createPortal(
        <div id="st-menu" role="dialog" aria-modal="true" aria-label="Menu" className={studioRoot("fixed inset-0 z-50 flex flex-col bg-canvas")}>
          <div className="flex h-16 items-center justify-between border-b border-line px-4 sm:px-6">
            <span className="text-[1.0625rem] font-extrabold tracking-[-0.02em]">{name}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-11 w-11 place-items-center rounded-md"><X aria-hidden className="h-5 w-5" /></button>
          </div>
          <ul className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {nav.map((l, i) => (
              <li key={l.href} className="st-rise" style={{ animationDelay: `${i * 45}ms` }}>
                <Link href={l.href} className="flex min-h-[64px] items-center justify-between border-b border-line text-[2rem] font-extrabold tracking-[-0.03em]">
                  {l.label}<span className="font-mono text-xs font-normal text-ink-3">0{i + 1}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-5 sm:px-6">
            <ThemeSwitcher inline />
            <Link href="/contact" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-action px-5 text-sm font-semibold text-on-action">Start a project<ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
