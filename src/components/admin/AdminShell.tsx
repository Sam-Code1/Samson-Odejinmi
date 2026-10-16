"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeartPulse, ShieldAlert, ChartLine, Contact, Gauge, Handshake, Mail, Megaphone, MessageCircle, Package, Target, WandSparkles, Workflow, Bot, BookOpenCheck, ScrollText, ShieldCheck, TicketPercent, AtSign, Award, BookOpen, Briefcase, ClipboardList, Compass, CreditCard, FolderOpen, Globe, HelpCircle, History, Home, Image as ImageIcon, Inbox, Layers, LayoutDashboard, LogOut, Menu, Paperclip, PenLine, PlayCircle, Search, Settings, Share2, Sparkles, User, UserCheck, Users, X } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationBell } from "@/components/app/NotificationBell";
import { signOut } from "@/app/auth-actions";
import { ToastProvider } from "./Toast";
import { cn } from "@/lib/utils";
import { can, ROLE_LABELS, type AdminRole, type Permission } from "@/lib/admin/roles";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; exact?: boolean; perm?: Permission };

const groups: { title: string; items: Item[] }[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { title: "Website", items: [
    { href: "/admin/website/homepage", label: "Homepage", icon: Home, perm: "website" },
    { href: "/admin/website/about", label: "About", icon: User, perm: "website" },
    { href: "/admin/website/portfolio", label: "Portfolio", icon: FolderOpen, perm: "website" },
    { href: "/admin/website/services", label: "Services", icon: Briefcase, perm: "website" },
    { href: "/admin/website/contact", label: "Contact", icon: AtSign, perm: "website" },
    { href: "/admin/website/messages", label: "Messages", icon: Inbox, perm: "website" },
    { href: "/admin/website/social", label: "Social links", icon: Share2, perm: "website" },
    { href: "/admin/website/seo", label: "SEO", icon: Search, perm: "website" },
  ] },
  { title: "Academy", items: [
    { href: "/admin/courses", label: "Courses", icon: BookOpen, perm: "academy" },
    { href: "/admin/modules", label: "Modules", icon: Layers, perm: "academy" },
    { href: "/admin/lessons", label: "Lessons", icon: PlayCircle, perm: "academy" },
    { href: "/admin/quizzes", label: "Quizzes", icon: ClipboardList, perm: "academy" },
    { href: "/admin/questions", label: "Question bank", icon: HelpCircle, perm: "academy" },
    { href: "/admin/resources", label: "Resources", icon: Paperclip, perm: "academy" },
  ] },
  { title: "People", items: [
    { href: "/admin/students", label: "Students", icon: Users, perm: "students" },
    { href: "/admin/enrolments", label: "Enrolments", icon: UserCheck, perm: "enrolments" },
    { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "payments" },
    { href: "/admin/certificates", label: "Certificates", icon: Award, perm: "certificates" },
  ] },
  { title: "Sales & marketing", items: [
    { href: "/admin/marketing", label: "Overview", icon: Gauge, exact: true, perm: "marketing" },
    { href: "/admin/products", label: "Products", icon: Package, perm: "products" },
    { href: "/admin/marketing/campaigns", label: "Campaigns", icon: Megaphone, perm: "marketing" },
    { href: "/admin/marketing/email", label: "Email", icon: Mail, perm: "marketing" },
    { href: "/admin/marketing/automations", label: "Automations", icon: Workflow, perm: "marketing" },
    { href: "/admin/marketing/customers", label: "Customers", icon: Contact, perm: "customers" },
    { href: "/admin/marketing/affiliates", label: "Affiliates", icon: Handshake, perm: "affiliates" },
    { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, perm: "coupons" },
    { href: "/admin/marketing/attribution", label: "Attribution", icon: Target, perm: "marketing" },
    { href: "/admin/marketing/analytics", label: "Analytics", icon: ChartLine, perm: "marketing" },
    { href: "/admin/marketing/assistant", label: "AI marketing assistant", icon: WandSparkles, perm: "marketing" },
    { href: "/admin/marketing/whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "marketing" },
  ] },
  { title: "AI tools", items: [
    { href: "/admin/ai", label: "AI overview", icon: Bot, exact: true, perm: "ai" },
    { href: "/admin/ai/quiz-generator", label: "Quiz generator", icon: Sparkles, perm: "ai" },
    { href: "/admin/ai/lesson-assistant", label: "Lesson assistant", icon: BookOpenCheck, perm: "ai" },
    { href: "/admin/ai/content-assistant", label: "Content assistant", icon: PenLine, perm: "ai" },
    { href: "/admin/ai/logs", label: "AI request log", icon: ScrollText, perm: "ai" },
  ] },
  { title: "System", items: [
    { href: "/admin/media", label: "Media", icon: ImageIcon, perm: "media" },
    { href: "/admin/settings/site", label: "Site settings", icon: Globe, perm: "settings" },
    { href: "/admin/settings", label: "Academy settings", icon: Settings, exact: true, perm: "settings" },
    { href: "/admin/settings/payments", label: "Payment settings", icon: CreditCard, perm: "payments" },
    { href: "/admin/system/health", label: "System health", icon: HeartPulse, perm: "settings" },
    { href: "/admin/system/security", label: "Security", icon: ShieldAlert, perm: "activity" },
    { href: "/admin/admins", label: "Admins", icon: ShieldCheck, perm: "admins" },
    { href: "/admin/activity", label: "Activity log", icon: History, perm: "activity" },
  ] },
];

function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role: AdminRole }) {
  const pathname = usePathname();
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/"));
  const link = "flex h-10 items-center gap-3 rounded px-3 text-[0.9375rem] font-medium transition-colors lg:h-9 lg:text-body-sm";
  return (
    <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(role, i.perm)) })).filter((g) => g.items.length > 0).map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-2 text-meta font-semibold uppercase tracking-wider text-ink-3">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const on = active(i);
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={onNavigate} title={i.label} aria-current={on ? "page" : undefined} className={cn(link, "relative", on ? "bg-surface text-ink" : "text-ink-2 hover:bg-surface/70 hover:text-ink")}>
                    {on && <span aria-hidden className="thread-v absolute inset-y-1.5 left-0 w-0.5 rounded-full" />}
                    <i.icon aria-hidden className={cn("h-4 w-4 shrink-0", on ? "text-blue" : "text-ink-3")} strokeWidth={1.5} />
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="border-t border-line pt-4">
        <ul className="space-y-0.5">
          <li><Link href="/academy" title="View Academy" onClick={onNavigate} className={cn(link, "text-ink-2 hover:bg-surface/70 hover:text-ink")}><Compass aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.5} />View Academy</Link></li>
          <li><Link href="/" title="View website" onClick={onNavigate} className={cn(link, "text-ink-2 hover:bg-surface/70 hover:text-ink")}><Globe aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.5} />View website</Link></li>
          <li><Link href="/profile" title="Profile" onClick={onNavigate} className={cn(link, "text-ink-2 hover:bg-surface/70 hover:text-ink")}><User aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.5} />Profile</Link></li>
          <li>
            <form action={signOut}>
              <button type="submit" title="Sign out" className={cn(link, "w-full text-ink-2 hover:bg-surface/70 hover:text-ink")}><LogOut aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.5} />Sign out</button>
            </form>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export function AdminShell({ email, role, children }: { email?: string; role: AdminRole; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <ToastProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-canvas lg:flex">
          <div className="flex h-16 shrink-0 items-center border-b border-line px-6">
            <Link href="/admin" className="text-[1.0625rem] font-semibold tracking-tight">Fola Academy<span className="ml-2 text-caption font-medium text-ink-3">Admin</span></Link>
          </div>
          <NavLinks role={role} />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:px-6 lg:h-16 lg:px-10">
            <div className="flex items-center gap-2">
              <button ref={btn} type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="admin-drawer" className="-ml-2 flex h-11 w-11 items-center justify-center rounded lg:hidden">
                <Menu aria-hidden className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <span className="text-label lg:hidden">Fola Academy</span>
            </div>
            <div className="flex items-center gap-2">
              <CommandPalette placeholder="Search students, products, payments, messages…" />
              <NotificationBell />
              {email && <span className="hidden max-w-[16rem] truncate text-caption text-ink-3 xl:inline">{email} · {ROLE_LABELS[role]}</span>}
              <ThemeSwitcher />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" />
            <div id="admin-drawer" role="dialog" aria-modal="true" aria-label="Admin navigation" className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col border-r border-line bg-canvas">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
                <span className="text-label">Fola Academy Admin</span>
                <button type="button" onClick={() => { setOpen(false); btn.current?.focus(); }} aria-label="Close navigation" className="-mr-2 flex h-11 w-11 items-center justify-center"><X aria-hidden className="h-5 w-5" strokeWidth={1.5} /></button>
              </div>
              <NavLinks role={role} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
